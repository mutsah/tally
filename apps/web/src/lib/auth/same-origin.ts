import { NextResponse } from 'next/server';

/**
 * Same-origin guard for MUTATING BFF route handlers (POST/PATCH/DELETE).
 *
 * Browsers always attach an `Origin` header to fetch mutations, so we require it
 * (falling back to `Referer`) to match the request's own host. A forged
 * cross-site POST therefore carries the attacker's origin and is rejected — CSRF
 * defense on top of the SameSite=Lax cookies, without the weight of token-based
 * CSRF (right-sized for a same-site BFF). GETs are not guarded (not state-
 * changing). Every current and future BFF mutation should call `enforceSameOrigin`.
 */
function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host; // host includes the port; robust behind a TLS proxy
  } catch {
    return null;
  }
}

export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get('host');
  if (!host) return false;
  const originHost =
    hostOf(req.headers.get('origin')) ?? hostOf(req.headers.get('referer'));
  return originHost !== null && originHost === host;
}

/** Returns a 403 response when the request is not same-origin, else null. */
export function enforceSameOrigin(req: Request): NextResponse | null {
  if (isSameOrigin(req)) return null;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
