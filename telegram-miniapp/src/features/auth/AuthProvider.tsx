'use client';

import { createThirdwebClient, defineChain } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";

// Create a single, shared client instance
export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

// Define the active chain (Sepolia for dev, Polygon for prod)
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 11155111; // Default to Sepolia
export const activeChain = defineChain(chainId);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
