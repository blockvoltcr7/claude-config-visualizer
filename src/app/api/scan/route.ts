import { NextResponse } from "next/server";
import { scanClaudeConfig } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await scanClaudeConfig();
  return NextResponse.json(data);
}
