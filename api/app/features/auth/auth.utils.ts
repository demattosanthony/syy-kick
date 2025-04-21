import crypto from "crypto";
import { StateEntry } from "./auth.types";


/**
 * @see https://auth0.com/docs/secure/attack-protection/state-parameters
 */
const cache = new Map<string, StateEntry>();
const TTL = 1000 * 60 * 5; // 5 min

export function generateStateEntry(redirectUrl: string): string {
    const state = crypto.randomUUID();
    const expiresAt = Date.now() + TTL;

    cache.set(state, { redirectUrl, expiresAt });

    return state;
}

export function getStateEntry(state: string): StateEntry | null {
    const entry = cache.get(state);

    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
        cache.delete(state);
        return null;
    }

    cache.delete(state);
    return entry;
}