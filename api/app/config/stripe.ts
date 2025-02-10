import Stripe from "stripe";
import db from "./db";
import { organizations, users } from "./schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const allowedEvents: Stripe.Event.Type[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "invoice.upcoming",
  "invoice.marked_uncollectible",
  "invoice.payment_succeeded",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
];

export async function syncStripeData(customerId: string) {
  try {
    const [stripeSubscriptions, organization, user] = await Promise.all([
      stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: "all",
        expand: ["data.default_payment_method"],
      }),
      db.query.organizations.findFirst({
        where: eq(organizations.stripeCustomerId, customerId),
      }),
      db.query.users.findFirst({
        where: eq(users.stripeCustomerId, customerId),
      }),
    ]);

    if (!organization && !user) {
      console.warn(
        `Customer ID ${customerId} not found in organizations or users.`
      );
      return;
    }

    const isOrganization = !!organization;
    const table = isOrganization ? organizations : users;

    if (stripeSubscriptions.data.length === 0) {
      await db
        .update(table)
        .set({
          subscriptionStatus: "incomplete",
          ...(isOrganization ? {} : { subscriptionPlan: "free" }),
        })
        .where(eq(table.stripeCustomerId, customerId));
      return { subscriptionId: null, status: "none" };
    }

    const subscription = stripeSubscriptions.data[0];
    const status = subscription.status as
      | "active"
      | "canceled"
      | "incomplete"
      | "incomplete_expired"
      | "past_due"
      | "trialing"
      | "unpaid";
    const priceObject = await stripe.prices.retrieve(
      subscription.items.data[0].price.id
    );
    const plan =
      priceObject.lookup_key === "yo-pro-plan"
        ? "pro"
        : priceObject.lookup_key === "yo-teams-plan"
        ? "teams"
        : "free";

    await db
      .update(table)
      .set({
        subscriptionStatus: status,
        ...(isOrganization ? {} : { subscriptionPlan: plan }),
      })
      .where(eq(table.stripeCustomerId, customerId));

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0].price.id,
      currentPeriodEnd: subscription.current_period_end,
      currentPeriodStart: subscription.current_period_start,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethod:
        typeof subscription.default_payment_method !== "string"
          ? {
              brand: subscription.default_payment_method?.card?.brand ?? null,
              last4: subscription.default_payment_method?.card?.last4 ?? null,
            }
          : null,
    };
  } catch (error) {
    console.error("Error syncing Stripe data:", error);
    throw error;
  }
}

export default stripe;
