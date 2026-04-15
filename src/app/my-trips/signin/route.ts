import { NextRequest, NextResponse } from "next/server";
import {
  verifyMagicLinkOneTime,
  signMagicLinkCookie,
  getParticipantAuthSecret,
} from "@/lib/participant-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse("Missing token", { status: 400 });
  const secret = getParticipantAuthSecret();
  const now = Date.now();
  const parsed = await verifyMagicLinkOneTime(token, secret, now);
  if (!parsed) {
    return NextResponse.redirect(new URL("/my-trips/request-link?invalid=1", req.url));
  }
  const cookie = await signMagicLinkCookie(parsed.email, now, secret);
  const res = NextResponse.redirect(new URL("/my-trips", req.url));
  res.cookies.set("wyjazdo_participant_email", cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 86_400,
    path: "/",
  });
  return res;
}
