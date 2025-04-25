import { eq, sql } from "drizzle-orm";
import db from "../../../config/db";
import { organizations, memberRoles } from "../../../config/schema";
import stripe from "../../../config/stripe";

export const ops = {
    updateSeats: async (orgId: string, seats: number) => {
        const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, orgId),
            columns: {
                stripeCustomerId: true,
            },
        });

        // If there's a Stripe customer, update their subscription
        if (org?.stripeCustomerId) {
            const subscription = await stripe.subscriptions.list({
                customer: org.stripeCustomerId,
                limit: 1,
            });

            if (subscription.data.length) {
                await stripe.subscriptions.update(subscription.data[0].id, {
                    items: [
                        {
                            quantity: seats,
                            id: subscription.data[0].items.data[0].id,
                        },
                    ],
                });
            }
        }

        // Update seats in database regardless of subscription status
        await db
            .update(organizations)
            .set({ seats, updatedAt: new Date() })
            .where(eq(organizations.id, orgId));
    },

    validateSeatUpdate: async (orgId: string, seats: number) => {
        const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, orgId),
        });

        if (!org) {
            throw new Error("Organization not found");
        }

        // Count unique members through memberRoles
        const memberCount = await db
            .select({ count: sql<number>`count(distinct ${memberRoles.userId})` })
            .from(memberRoles)
            .where(eq(memberRoles.organizationId, orgId))
            .then(result => result[0].count);

        // Don't allow reducing seats below current member count
        if (seats < memberCount) {
            throw new Error("Cannot reduce seats below current member count");
        }
    }
}