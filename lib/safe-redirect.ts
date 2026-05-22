/**
 * Same-origin redirect-target validation.
 *
 * The `?next=` parameter travels through the recovery flow (deep link →
 * /recover → Invitation.nextPath → /r/[token]). At every hop it must be
 * re-validated: an attacker could otherwise hand a victim a link like
 * /recover?next=https://evil.com and turn the recovery flow into an open
 * redirect.
 *
 * A safe value is an absolute *path* on this origin:
 *   - starts with a single "/"
 *   - NOT "//" or "/\" (protocol-relative — browsers treat these as
 *     cross-origin)
 *   - no scheme, no whitespace, no backslashes
 *
 * Returns the path unchanged when safe, otherwise null.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.length > 512) return null; // absurdly long → reject
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\s\\]/.test(raw)) return null;
  if (raw.includes("://")) return null;
  return raw;
}
