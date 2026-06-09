import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rabbitty/database-core"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_BUNZ_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_BUNZ_CONTRACT_ADDRESS || '',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org',
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '11155111',
    NEXT_PUBLIC_ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID || '798431743',
  },
};

export default nextConfig;
