import stripe, { allowedEvents, syncStripeData } from "../config/stripe";
import db from "../config/db";
import { organizations, users } from "../config/schema";
import { eq } from "drizzle-orm";
import { Request, Response, Router } from "express";

type CheckoutSessionParams = {
  userId: string;
  email: string;
  lookupKey: string;
  stripeCustomerId?: string;
  quantity?: number;
  organizationId?: string;
};

// Helper functions
const getStripeCustomer = async (
  organizationId: string | undefined,
  dbUser: any
) => {
  if (organizationId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });
    return org?.stripeCustomerId;
  }
  return dbUser?.stripeCustomerId;
};

const createCustomer = async (
  email: string,
  userId: string,
  organizationId?: string
) => {
  const customer = await stripe.customers.create({
    email,
    metadata: organizationId ? { organizationId } : { userId },
  });

  const table = organizationId ? organizations : users;
  const idField = organizationId ? organizationId : userId;

  await db
    .update(table)
    .set({ stripeCustomerId: customer.id })
    .where(eq(table.id, idField));

  return customer;
};

const createCheckoutSession = async (params: CheckoutSessionParams) => {
  const {
    userId,
    organizationId,
    quantity = 1,
    email,
    stripeCustomerId,
    lookupKey,
  } = params;

  const customerId =
    stripeCustomerId ||
    (await createCustomer(email, userId, organizationId)).id;

  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    expand: ["data.product"],
  });

  return stripe.checkout.sessions.create({
    billing_address_collection: "auto",
    customer: customerId,
    line_items: [{ price: prices.data[0].id, quantity: quantity }],
    mode: "subscription",
    success_url: organizationId
      ? `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&organization_id=${organizationId}`
      : `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: organizationId
      ? `${process.env.FRONTEND_URL}?orgId=${organizationId}`
      : `${process.env.FRONTEND_URL}`,
    metadata: organizationId
      ? { organization_id: organizationId }
      : { user_id: userId },
    subscription_data: {
      metadata: organizationId
        ? { organization_id: organizationId }
        : { user_id: userId },
    },
  });
};

// Handlers
const handlers = {
  checkout: async (req: Request, res: Response) => {
    try {
      const stripeCustomerId = await getStripeCustomer(
        req.body.organization_id,
        req.dbUser
      );
      const session = await createCheckoutSession({
        userId: req.dbUser!.id,
        email: req.dbUser!.email,
        lookupKey: req.body.lookup_key,
        stripeCustomerId,
        organizationId: req.body.organization_id,
        quantity: req.body.seats,
      });
      res.json({ url: session.url });
    } catch (error) {
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  },

  sync: async (req: Request, res: Response) => {
    try {
      const stripeCustomerId = await getStripeCustomer(
        req.body.organization_id,
        req.dbUser
      );
      if (!stripeCustomerId) {
        res.status(400).json({ error: "No billing information found" });
        return;
      }
      await syncStripeData(stripeCustomerId);
      res.json({ message: "Successfully synced data" });
    } catch (error) {
      res.status(500).json({ error: "Failed to sync data" });
    }
  },

  portal: async (req: Request, res: Response) => {
    try {
      const stripeCustomerId = await getStripeCustomer(
        req.body.organization_id,
        req.dbUser
      );
      if (!stripeCustomerId) {
        res.status(400).json({ error: "No billing information found" });
        return;
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: process.env.FRONTEND_URL + (req.body.return_url || "/"),
      });
      res.json({ url: session.url });
    } catch (error) {
      res.status(500).json({ error: "Failed to create portal session" });
    }
  },

  webhook: async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    try {
      const event = await stripe.webhooks.constructEventAsync(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      if (allowedEvents.includes(event.type)) {
        const { customer: customerId } = event.data.object as {
          customer: string;
        };
        if (typeof customerId === "string") await syncStripeData(customerId);
      }
      res.json({ received: true });
    } catch (error) {
      res.status(400).json({ error: "Webhook error" });
    }
  },
};

export const { webhook } = handlers;

export default Router()
  .post("/create-checkout-session", handlers.checkout)
  .post("/sync-after-success", handlers.sync)
  .post("/create-portal-session", handlers.portal);
