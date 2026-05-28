import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseTelegramUser } from '@/lib/telegramAuth';

// Helper for parsing time "HH:MM" into minutes since midnight
const timeToMinutes = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export async function POST(req: Request) {
  try {
    const { initData, businessId, fiatAmount = 100 } = await req.json();

    if (!initData || !businessId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Validar el usuario (en producción usarías validateTelegramInitData)
    const tUser = parseTelegramUser(initData);
    if (!tUser || !tUser.id) {
      return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: tUser.id.toString() }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 404 });
    }

    // 2. Obtener el negocio
    const business = await prisma.ownedBusiness.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // 3. El Oráculo: Validar "Happy Hour"
    const now = new Date();
    // getDay() en JS: 0=Domingo, 1=Lunes, 2=Martes... 6=Sábado. 
    // Mapearemos 1=Lunes ... 7=Domingo para estar alineados con UI
    let currentDayIndex = now.getDay();
    if (currentDayIndex === 0) currentDayIndex = 7; 

    let activeDaysArr = [];
    try { activeDaysArr = JSON.parse(business.activeDays); } catch (e) {}

    // Validar Día
    if (!activeDaysArr.includes(currentDayIndex)) {
      await prisma.transaction.create({
        data: {
          userId: user.id, businessId, fiatAmount, bunzMinted: 0,
          status: 'FAILED', errorMessage: 'Escaneo fuera del día permitido (Happy Hour inactiva)'
        }
      });
      return NextResponse.json({ error: 'Hoy no hay Happy Hour en este negocio. ¡Vuelve pronto!' }, { status: 403 });
    }

    // Validar Hora
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(business.startTime);
    const endMinutes = timeToMinutes(business.endTime);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      await prisma.transaction.create({
        data: {
          userId: user.id, businessId, fiatAmount, bunzMinted: 0,
          status: 'FAILED', errorMessage: 'Escaneo fuera de la hora permitida'
        }
      });
      return NextResponse.json({ error: `El escaneo solo es válido entre las ${business.startTime} y las ${business.endTime}` }, { status: 403 });
    }

    // 4. Calcular Recompensa
    const bunzEarned = Math.floor(fiatAmount * (business.rewardPercentage / 100));

    // 5. Sistema Híbrido Interno (Ledger Off-chain)
    // Usamos una transacción SQL para asegurar consistencia
    const [transaction, updatedUser] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: user.id,
          businessId,
          fiatAmount,
          bunzMinted: bunzEarned,
          status: 'MINTED' // MINTED internally (off-chain points granted)
        }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { totalBunzEarned: { increment: bunzEarned } }
      })
    ]);

    return NextResponse.json({ 
      success: true, 
      bunzEarned, 
      newBalance: updatedUser.totalBunzEarned,
      transactionId: transaction.id
    });

  } catch (error) {
    console.error('Oracle Transaction Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
