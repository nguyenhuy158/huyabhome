export const OWNER_COOKIE = "notes_owner";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const OWNER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readOwnerId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.split("=");
    if (rawName.trim() !== OWNER_COOKIE) continue;
    const value = decodeURIComponent(rest.join("=").trim());
    return OWNER_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function ownerCookieHeader(ownerId: string): string {
  return [
    `${OWNER_COOKIE}=${encodeURIComponent(ownerId)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}
