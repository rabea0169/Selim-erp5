import { NextResponse } from "next/server";
import { db } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbStatus: "up" | "down" = "up";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "down";
  }

  return NextResponse.json(
    {
      status: "ok",
      db: dbStatus,
      timestamp: new Date().toISOString(),
    },
    { status: dbStatus === "up" ? 200 : 503 }
  );
}
