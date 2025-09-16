import api from "./api";
import { User } from "@/types/user";

const MIGRATION_ATTEMPTED_KEY = "syy-cookie-migration-attempted";
const MIGRATION_SUCCESS_KEY = "syy-cookie-migration-success";

/**
 * Attempts to migrate cookies from old domain to new API domain
 * This should be called early in the app initialization
 */
export async function attemptCookieMigration(): Promise<{
  attempted: boolean;
  migrated: boolean;
  user?: User | null;
}> {
  // Check if we've already attempted migration
  const migrationAttempted = localStorage.getItem(MIGRATION_ATTEMPTED_KEY);
  const migrationSuccess = localStorage.getItem(MIGRATION_SUCCESS_KEY);

  if (migrationAttempted === "true") {
    return {
      attempted: true,
      migrated: migrationSuccess === "true",
    };
  }

  try {
    console.log("Attempting cookie migration...");

    // Mark as attempted immediately to prevent multiple attempts
    localStorage.setItem(MIGRATION_ATTEMPTED_KEY, "true");

    const result = await api.auth.migrateCookies();

    if (result.migrated) {
      localStorage.setItem(MIGRATION_SUCCESS_KEY, "true");
      console.log("Cookie migration successful!");
      return {
        attempted: true,
        migrated: true,
        user: result.user,
      };
    } else {
      console.log("Cookie migration not needed or failed:", result.reason);
      return {
        attempted: true,
        migrated: false,
      };
    }
  } catch (error) {
    console.error("Cookie migration error:", error);
    return {
      attempted: true,
      migrated: false,
    };
  }
}

/**
 * Resets migration flags (useful for testing or force re-migration)
 */
export function resetMigrationFlags() {
  localStorage.removeItem(MIGRATION_ATTEMPTED_KEY);
  localStorage.removeItem(MIGRATION_SUCCESS_KEY);
}

/**
 * Checks if cookie migration has been successfully completed
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_SUCCESS_KEY) === "true";
}
