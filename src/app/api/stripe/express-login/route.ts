import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrganizerByClerkUserId } from "@/lib/db/queries/organizers";
import { createExpressLoginLink } from "@/lib/stripe-connect";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
  }
  const organizer = await getOrganizerByClerkUserId(userId);
  if (!organizer?.stripeAccountId) {
    return NextResponse.json({ error: "not connected" }, { status: 400 });
  }
  const { url } = await createExpressLoginLink(organizer.stripeAccountId);
  return NextResponse.redirect(url);
}
