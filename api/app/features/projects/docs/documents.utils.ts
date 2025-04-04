/**
 * Normalizes a path:
 * - Trims leading/trailing slashes
 * - Replaces multiple slashes with a single slash
 */
export function normalizePath(input: string) {
  // Remove leading/trailing slashes
  const trimmed = input.replace(/^\/+|\/+$/g, "");
  // Replace multiple consecutive slashes with single
  return trimmed.replace(/\/{2,}/g, "/");
}
