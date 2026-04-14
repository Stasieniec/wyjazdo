import { NextRequest, NextResponse } from "next/server";
import { processRegistration } from "@/lib/register/process-registration";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { errors: { _form: "Zbyt wiele prób. Spróbuj ponownie za minutę." } },
      { status: 429 },
    );
  }

  const form = await req.formData();
  const result = await processRegistration(form, req.nextUrl.protocol);
  if ("errors" in result) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  return NextResponse.redirect(result.redirectUrl, 303);
}
