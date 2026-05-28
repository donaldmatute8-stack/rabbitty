import { NextResponse } from "next/server";

export async function GET() {
  try {
    const formattedOffers = [
      {
        id: "1",
        title: "2x1 en Lattes Especiales",
        description: "Disfruta de dos lattes por el precio de uno.",
        bunzCost: 50,
        businessName: "626 Cafe",
        businessLogo: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=150&q=80",
        limit: 10,
        isAvailable: true,
        image: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80",
      },
      {
        id: "2",
        title: "Postre Gratis con tu Cena",
        description: "En la compra de cualquier platillo fuerte, llévate un postre.",
        bunzCost: 120,
        businessName: "Kukara",
        businessLogo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=150&q=80",
        limit: 5,
        isAvailable: true,
        image: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80",
      }
    ];

    return NextResponse.json({ success: true, offers: formattedOffers });
  } catch (error: any) {
    console.error("[OFFERS_ERROR]", error);
    return NextResponse.json({ error: "Error fetching offers" }, { status: 500 });
  }
}
