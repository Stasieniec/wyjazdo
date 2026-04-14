import { NextRequest, NextResponse } from "next/server";
import { processRegistration } from "@/lib/register/process-registration";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const result = await processRegistration(form, req.nextUrl.protocol);
  if ("errors" in result) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  return NextResponse.redirect(result.redirectUrl, 303);
}
