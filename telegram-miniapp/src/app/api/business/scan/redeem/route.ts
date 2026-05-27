import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { businessWallet, qrCodeData } = await req.json();

    if (!businessWallet || !qrCodeData) {
      return NextResponse.json({ error: "Faltan parámetros requeridos." }, { status: 400 });
    }

    // Identificar al negocio
    const profile = await prisma.profile.findUnique({
      where: { smart_wallet_address: businessWallet },
      include: { business: true }
    });

    if (!profile || !profile.business) {
      return NextResponse.json({ error: "Negocio no encontrado o no autorizado." }, { status: 403 });
    }

    const businessId = profile.business.id;

    // Buscar el certificado (PurchasedOffer) usando el código QR
    const purchasedOffer = await prisma.purchasedOffer.findFirst({
      where: { qr_code_data: qrCodeData },
      include: { 
        offer: { include: { business: true } },
        profile: true
      }
    });

    if (!purchasedOffer) {
      return NextResponse.json({ error: "Código QR inválido o certificado no existe." }, { status: 404 });
    }

    if (purchasedOffer.offer.businessId !== businessId) {
      return NextResponse.json({ error: "Este certificado pertenece a otro negocio." }, { status: 403 });
    }

    if (purchasedOffer.status !== "ACTIVE") {
      return NextResponse.json({ error: `El certificado ya ha sido procesado o expiró (Estado: ${purchasedOffer.status}).` }, { status: 400 });
    }

    // Actualizar estado a REDEEMED
    const redeemedOffer = await prisma.purchasedOffer.update({
      where: { id: purchasedOffer.id },
      data: { status: "REDEEMED" }
    });

    // Notificar al usuario (opcional)
    await prisma.notification.create({
      data: {
        profileId: purchasedOffer.profileId,
        title: "¡Certificado Canjeado!",
        message: `Tu certificado de "${purchasedOffer.offer.title}" fue canjeado con éxito en ${purchasedOffer.offer.business.name}.`,
        type: "SUCCESS"
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Canje exitoso", 
      offerTitle: purchasedOffer.offer.title 
    });

  } catch (error: any) {
    console.error("[REDEEM_ERROR]", error);
    return NextResponse.json({ error: error.message || "Error procesando el canje" }, { status: 500 });
  }
}
