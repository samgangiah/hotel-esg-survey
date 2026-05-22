import { NextRequest, NextResponse } from "next/server";

// Edge-runtime middleware. Cannot touch Prisma. Only checks the *signature* on
// the admin cookie — the page itself does the DB lookup for the session.
//
// Coarse first gate, not the only one. Even if a forged cookie passed the
// signature (it can't — the key is server-side), the page lookup would fail.

const ADMIN_COOKIE = "esg_admin";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;

  // Forward the requested path+search as a request header so server
  // components (the auth helpers) can read it — they otherwise have no
  // access to the current URL. Used to build the ?next= redirect target
  // when an unauthenticated user deep-links into a gated page.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", path + url.search);
  const pass = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  // Platform admin portal: gated except for the login + verify entry points.
  if (path.startsWith("/admin")) {
    if (path === "/admin/login" || path.startsWith("/admin/verify")) {
      return pass();
    }
    const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!cookie || !(await isSignatureValid(cookie))) {
      const loginUrl = url.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  return pass();
}

export const config = {
  matcher: ["/admin/:path*", "/survey/:path*", "/operator/:path*"],
};

// --- Edge-compatible HMAC verification (Web Crypto, not Node crypto) -------

async function isSignatureValid(packed: string): Promise<boolean> {
  const dot = packed.lastIndexOf(".");
  if (dot < 0) return false;
  const id = packed.slice(0, dot);
  const sig = packed.slice(dot + 1);

  const key = process.env.SESSION_SIGNING_KEY;
  if (!key) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(id))
  );
  const expected = base64url(expectedBytes);
  return constantTimeEq(expected, sig);
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}
