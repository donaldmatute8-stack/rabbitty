const ORACLE_URL = () => process.env.ORACLE_URL;

export async function sendToOracle(params: {
  businessAddress: string;
  userAddress: string;
  purchaseAmount: number;
  receiptHash: string;
}): Promise<{ success: boolean; txHash?: string; error?: string } | null> {
  const url = ORACLE_URL();
  if (!url) return null;

  try {
    const res = await fetch(`${url}/process-consumption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Oracle] process-consumption failed:", text);
      return { success: false, error: text.slice(0, 200) };
    }

    const data = await res.json();
    return { success: true, txHash: data.txHash };
  } catch (e: any) {
    console.error("[Oracle] connection error:", e.message);
    return { success: false, error: e.message };
  }
}
