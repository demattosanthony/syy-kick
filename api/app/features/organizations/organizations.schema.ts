/** Zod */
import { z } from "zod";

export const schemas = {
    org: z.object({
        name: z.string().min(1),
        domain: z.string().optional(),
        logo: z.string().optional(),
        seats: z.number().optional(),
        saml: z
            .object({
                entryPoint: z.string().url().optional(),
                issuer: z.string().optional(),
                cert: z.string().optional(),
                callbackUrl: z.string().url().optional(),
            })
            .optional(),
    }),
    member: z.object({
        email: z.string().email(),
        role: z.enum(["owner", "member"]),
    }),
};
