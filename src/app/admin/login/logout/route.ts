import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminSessionCookie();
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  const proto = process.env.NODE_ENV === "production" ? "https:" : "http:";
  return NextResponse.redirect(`${proto}//${host}/admin/login`, { status: 303 });
}
