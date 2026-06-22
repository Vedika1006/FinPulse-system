/**
 * Client-side session helpers (expiry only — signature is verified by the API).
 */

export function clearAuthToken() {
  localStorage.removeItem("token");
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}

/** Use for routing: only trust non-dummy, well-formed, unexpired JWTs. */
export function hasValidAuthSession() {
  const token = localStorage.getItem("token");
  if (!token || token === "dummy") return false;
  const parts = token.split(".");
  if (parts.length !== 3) {
    clearAuthToken();
    return false;
  }
  if (isTokenExpired(token)) {
    clearAuthToken();
    return false;
  }
  return true;
}

function titleCase(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Best-effort display name for personalization.
 * - If a profile object is provided, prefers fullName/email.
 * - Otherwise returns a friendly fallback.
 */
export function getUserDisplayName(profile) {
  const fullName = profile?.fullName || profile?.name;
  if (fullName && typeof fullName === "string" && fullName.trim()) return titleCase(fullName.trim());

  const email = profile?.email;
  if (email && typeof email === "string" && email.includes("@")) {
    const base = email.split("@")[0].replace(/[._-]+/g, " ").trim();
    if (base) return titleCase(base);
  }

  return "Friend";
}
