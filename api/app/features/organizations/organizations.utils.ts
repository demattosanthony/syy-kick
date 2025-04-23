/** Drizzle */
import { sql } from "drizzle-orm";

export const crypto = {
    encrypt: (value: string) => {
        const key = process.env.PGCRYPTO_KEY;
        return sql`pgp_sym_encrypt(${value}::text, ${key})`;
    },
    decrypt: (field: string) => {
        const key = process.env.PGCRYPTO_KEY;
        return sql`pgp_sym_decrypt(${field}, ${key})::text`;
    },
};