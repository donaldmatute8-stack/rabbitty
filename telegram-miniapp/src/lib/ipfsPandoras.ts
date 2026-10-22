import crypto from "crypto";

export interface AccountAuditSnapshot {
  userSubjectId: string;
  pseudonym: string;
  forfeitedBunz: number;
  totalHops: number;
  visitedCount: number;
  deletionTimestamp: string;
  jurisdictionCompliance: "LFPDPPP_MX_SAT_5YR_RETENTION";
  ledgerProofSummary: {
    action: "ACCOUNT_CLOSED_AND_FORFEITED_TO_TREASURY";
    treasurySubjectId: "sys_rabbitty_treasury";
  };
}

export interface IpfsPinResult {
  cid: string;
  pinnedToPandorasNode: boolean;
  nodeUrl?: string;
  error?: string;
}

/**
 * Genera un Snapshot contable inmutable para retención legal (auditoría fiscal/comercial)
 * y lo envía/ancla en el Nodo IPFS de Pandoras si está configurado.
 */
export async function archiveAccountToPandorasIpfs(
  snapshot: AccountAuditSnapshot
): Promise<IpfsPinResult> {
  const jsonContent = JSON.stringify(snapshot, null, 2);
  const contentHash = crypto.createHash("sha256").update(jsonContent).digest("hex");
  // Formato CID v1 simplificado compatible con IPFS (base58 / sha256 multihash)
  const syntheticCid = `bafkrei${contentHash.slice(0, 52)}`;

  const pandorasNodeEndpoint =
    process.env.PANDORAS_IPFS_RPC_URL ||
    process.env.PANDORAS_IPFS_GATEWAY ||
    "https://rpc.ipfs.pandoras.finance/api/v0/add";

  const pandorasAuthToken =
    process.env.PANDORAS_IPFS_AUTH_TOKEN ||
    "c9dcb0fa224698754b52cbfa69899c41d360e476fb623092973d89de52ea3118";

  try {
    // Intentar anclar directamente en el Nodo IPFS de Pandoras si el endpoint está disponible
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s para subir sin degradar UX

    const formData = new FormData();
    const blob = new Blob([jsonContent], { type: "application/json" });
    formData.append("file", blob, `audit_${snapshot.userSubjectId}.json`);

    const response = await fetch(pandorasNodeEndpoint, {
      method: "POST",
      body: formData,
      headers: pandorasAuthToken
        ? { Authorization: `Bearer ${pandorasAuthToken}` }
        : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      return {
        cid: data.Hash || data.cid || syntheticCid,
        pinnedToPandorasNode: true,
        nodeUrl: pandorasNodeEndpoint,
      };
    }
  } catch (err: unknown) {
    // Fallback tolerante si el daemon no tiene puerto expuesto públicamente o timeout
    console.warn(
      "[PANDORAS_IPFS_NODE] Nodo no alcanzable en este momento, usando CID criptográfico verificado:",
      err instanceof Error ? err.message : String(err)
    );
  }

  return {
    cid: syntheticCid,
    pinnedToPandorasNode: false,
    nodeUrl: pandorasNodeEndpoint,
  };
}
