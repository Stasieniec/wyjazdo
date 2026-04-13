import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const tenant = resolveTenant(host, ROOT);
  const url = req.nextUrl.clone();

  if (tenant.kind === "tenant") {
    // Don't rewrite API routes or static files on subdomains
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
      return NextResponse.next();
    }
    url.pathname = `/_sites/${tenant.subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except static assets and image optimization
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
