import { seedLegalDocuments } from "@/lib/legal/seed-documents";
import { NextResponse } from "next/server";

export async function GET() {
  const results = await seedLegalDocuments();
  return NextResponse.json(results);
}
