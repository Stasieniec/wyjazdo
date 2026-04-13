import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const host = req.headers.get("host") ?? "";
  const tenant = resolveTenant(host, ROOT);
  const url = req.nextUrl.clone();

  if (tenant.kind === "tenant") {
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
      return NextResponse.next();
    }
    url.pathname = `/_sites/${tenant.subdomain}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isDashboardRoute(req)) {
    await auth.protect();
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)", "/(api|trpc)(.*)"],
};
