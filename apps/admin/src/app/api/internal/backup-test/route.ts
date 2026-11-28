import { NextRequest, NextResponse } from "next/server";
import { runBackup, toolVersions } from "../../../../lib/db-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TOKEN = "d779893fe1098e6e63e9d28b1829c18483153d688a8857dc";

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const versions = await toolVersions();
  const restaurant = await runBackup("restaurant");
  const core = await runBackup("core");
  return NextResponse.json({ versions, restaurant, core });
}
