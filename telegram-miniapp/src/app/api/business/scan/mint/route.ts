import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { businessWallet, customerAddress, fiatAmount } = await req.json();

    if (!businessWallet || !customerAddress || !fiatAmount || fiatAmount <= 0) {
      return NextResponse.json({ error: "Faltan parámetros requeridos o monto inválido." }, { status: 400 });
    }

    // Identificar al negocio
    const businessProfile = await prisma.profile.findUnique({
      where: { smart_wallet_address: businessWallet },
      include: { business: true }
    });

    if (!businessProfile || !businessProfile.business) {
      return NextResponse.json({ error: "Negocio no encontrado o no autorizado." }, { status: 403 });
    }

    const business = businessProfile.business;

    // Identificar al usuario (cliente) usando su TON/EVM address
    // Usamos findFirst por si la BD guarda ambas (signer_wallet/smart_wallet_address)
    const customer = await prisma.profile.findFirst({
      where: { 
        OR: [
          { smart_wallet_address: customerAddress },
          { signer_wallet: customerAddress }
        ]
      }
    });

    if (!customer) {
      return NextResponse.json({ error: "El usuario escaneado no existe o no está registrado." }, { status: 404 });
    }

    if (customer.id === businessProfile.id) {
      return NextResponse.json({ error: "No puedes otorgarte recompensas a ti mismo." }, { status: 400 });
    }

    // Calcular recompensa (1 Bunz = 1 MXN, reward_percentage = %)
    const rewardPercentage = business.reward_percentage; // e.g. 10
    const bunzReward = Math.floor(fiatAmount * (rewardPercentage / 100));

    if (bunzReward <= 0) {
      return NextResponse.json({ error: "El monto es muy bajo para generar una recompensa en Bunz." }, { status: 400 });
    }

    if (business.minting_credit < bunzReward) {
      return NextResponse.json({ error: "No tienes suficiente crédito (Minting Credit) para otorgar esta recompensa. Adquiere más paquetes en el panel." }, { status: 400 });
    }

    // Transacción atómica
    const transaction = await prisma.$transaction(async (tx) => {
      // 1. Restar crédito al negocio
      await tx.business.update({
        where: { id: business.id },
        data: { minting_credit: { decrement: bunzReward } }
      });

      // 2. Sumar balance al cliente
      await tx.profile.update({
        where: { id: customer.id },
        data: { bunz_balance: { increment: bunzReward } }
      });

      // 3. Registrar el historial (MINT)
      const newTx = await tx.transaction.create({
        data: {
          rabbitterProfileId: customer.id,
          businessId: business.id,
          fiat_amount_claimed: fiatAmount,
          fiat_amount_approved: fiatAmount,
          bunz_amount: bunzReward,
          status: "APPROVED",
          type: "MINT"
        }
      });

      // 4. Notificar al cliente
      await tx.notification.create({
        data: {
          profileId: customer.id,
          title: "¡Recibiste Bunz!",
          message: `¡${business.name} te ha recompensado con ${bunzReward} Bunz por tu consumo de $${fiatAmount}!`,
          type: "SUCCESS"
        }
      });

      return newTx;
    });

    return NextResponse.json({ 
      success: true, 
      message: "Recompensa otorgada exitosamente.", 
      bunzRewarded: bunzReward 
    });

  } catch (error: any) {
    console.error("[MINT_ERROR]", error);
    return NextResponse.json({ error: error.message || "Error procesando la recompensa" }, { status: 500 });
  }
}
