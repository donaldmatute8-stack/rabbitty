import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pushDevices } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { token, platform } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const cleanToken = token.trim().slice(0, 4096);
    const cleanPlatform = typeof platform === "string" && platform.trim()
      ? platform.trim().slice(0, 20)
      : "unknown";

    try {
      await db
        .insert(pushDevices)
        .values({
          userId: caller.id,
          token: cleanToken,
          platform: cleanPlatform,
          isActive: true,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: pushDevices.token,
          set: {
            userId: caller.id,
            platform: cleanPlatform,
            isActive: true,
            updatedAt: new Date(),
          },
        });
    } catch (dbError) {
      // The table may not exist yet (migration 0008 pending). Never fail the
      // client registration because of a persistence gap.
      console.warn("[PUSH_TOKEN_POST] persist skipped:", dbError instanceof Error ? dbError.message : dbError);
      return NextResponse.json({ success: true, registered: true, persisted: false });
    }

    return NextResponse.json({ success: true, registered: true, persisted: true });
  } catch (error) {
    console.error("[PUSH_TOKEN_POST]", error);
    return NextResponse.json({ error: "Error guardando push token" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    try {
      await db
        .update(pushDevices)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(pushDevices.token, token.trim().slice(0, 4096)),
            eq(pushDevices.userId, caller.id)
          )
        );
    } catch (dbError) {
      console.warn("[PUSH_TOKEN_DELETE] skipped:", dbError instanceof Error ? dbError.message : dbError);
      return NextResponse.json({ success: true, persisted: false });
    }

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error("[PUSH_TOKEN_DELETE]", error);
    return NextResponse.json({ error: "Error desactivando push token" }, { status: 500 });
  }
}
