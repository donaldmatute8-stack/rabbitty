import { getRestaurantDb } from "@rabbitty/api/db";
import { branches, menuCategories, menuItems } from "@rabbitty/database-restaurant";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MenuBoardPage({ params }: { params: { branchId: string } }) {
  const db = getRestaurantDb();
  const [branch] = await db.select().from(branches).where(eq(branches.id, params.branchId));
  if (!branch) notFound();

  const categories = await db
    .select()
    .from(menuCategories)
    .where(and(eq(menuCategories.branchId, params.branchId), eq(menuCategories.isActive, true)))
    .orderBy(menuCategories.sortOrder);

  const items = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.branchId, params.branchId), eq(menuItems.isActive, true), eq(menuItems.isAvailable, true)))
    .orderBy(menuItems.sortOrder);

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{branch.name} - Menú Digital</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{
        margin: 0, padding: 0, minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)",
        color: "white",
      }}>
        <div style={{ padding: "40px 60px", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 48, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 24,
          }}>
            <div>
              <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                {branch.name}
              </h1>
              <p style={{ color: "#9CA3AF", margin: "8px 0 0", fontSize: 18 }}>
                Menú Digital
              </p>
            </div>
            <div style={{ fontSize: 14, color: "#6B7280" }}>
              Actualizado: {new Date().toLocaleString("es-MX")}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 32 }}>
            {categories.map((cat) => {
              const catItems = items.filter((i) => i.categoryId === cat.id);
              return (
                <div key={cat.id} style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
                  padding: 24, backdropFilter: "blur(10px)",
                }}>
                  <h2 style={{
                    fontSize: 22, fontWeight: 700, margin: "0 0 4px",
                    background: "linear-gradient(to right, #fff, #9CA3AF)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p style={{ color: "#6B7280", fontSize: 13, margin: "0 0 16px" }}>{cat.description}</p>
                  )}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                    {catItems.map((item) => (
                      <div key={item.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        <div>
                          <p style={{ fontWeight: 600, margin: 0, fontSize: 16 }}>{item.name}</p>
                          {item.description && (
                            <p style={{ color: "#6B7280", fontSize: 12, margin: "2px 0 0" }}>{item.description}</p>
                          )}
                        </div>
                        <p style={{
                          fontWeight: 700, fontSize: 18, margin: 0,
                          color: "#34D399",
                        }}>
                          ${item.price.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {!catItems.length && (
                    <p style={{ color: "#6B7280", fontSize: 13, textAlign: "center", padding: 16 }}>
                      Sin productos disponibles
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center", fontSize: 12, color: "#4B5563",
          }}>
            <p>Powered by Rabbitty — Menú sincronizado automáticamente</p>
          </div>
        </div>
      </body>
    </html>
  );
}
