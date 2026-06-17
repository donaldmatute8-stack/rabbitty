import { NextRequest, NextResponse } from "next/server";
import { getRestaurantDb } from "@rabbitty/api/db";
import { branches, menuCategories, menuItems } from "@rabbitty/database-restaurant";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest, { params }: { params: { branchId: string } }) {
  try {
    const branchId = params.branchId;
    const db = getRestaurantDb();

    const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    const categories = await db
      .select()
      .from(menuCategories)
      .where(and(eq(menuCategories.branchId, branchId), eq(menuCategories.isActive, true)))
      .orderBy(menuCategories.sortOrder);

    const items = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.branchId, branchId), eq(menuItems.isActive, true), eq(menuItems.isAvailable, true)))
      .orderBy(menuItems.sortOrder);

    const menu = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      items: items
        .filter((item) => item.categoryId === cat.id)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          imageUrl: item.imageUrl,
          sku: item.sku,
        })),
    }));

    return NextResponse.json({
      branch: { id: branch.id, name: branch.name },
      updatedAt: new Date().toISOString(),
      menu,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
