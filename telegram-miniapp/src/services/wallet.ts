// Wallet Blockchain Service
// Integración con ethers.js para Rabbitty

import { ethers } from 'ethers';

// Configuración
// Sepolia Testnet para testing
const BUNZ_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_BUNZ_CONTRACT_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'; // Localhost deploy (cambiar a Sepolia cuando se despliegue)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org'; // Sepolia testnet
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '11155111'); // Sepolia chain ID

// ABI mínimo del contrato bunz.sol
const BUNZ_ABI = [
  // ERC20 standard
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  
  // Rabbitty specific
  'function mintReward(address business, address user, uint256 purchaseAmount, bytes32 receiptHash)',
  'function spendBunz(address to, uint256 amount)',
  'function getBusinessCredit(address business) view returns (uint256, uint256)',
  'function getBusinessRate(address business) view returns (uint256)',
  'function registerBusiness(address business, uint256 creditLimit, string businessType, uint256 initialRate)',
  
  // Events
  'event Transfer(address indexed from, address indexed to, uint256 amount)',
  'event RewardMinted(address indexed business, address indexed user, uint256 purchaseAmount, uint256 rewardAmount, bytes32 receiptHash)',
  'event BunzSpent(address indexed user, address indexed business, uint256 amount, uint256 protocolFee, uint256 affiliateFee)',
];

export class BunzWallet {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private signer: ethers.Signer | null = null;
  
  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.contract = new ethers.Contract(BUNZ_CONTRACT_ADDRESS, BUNZ_ABI, this.provider);
  }
  
  // Conectar wallet (MetaMask, WalletConnect, etc)
  async connect(): Promise<string> {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('No wallet detected');
    }
    
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    this.signer = await provider.getSigner();
    
    return accounts[0];
  }
  
  // Obtener balance
  async getBalance(address: string): Promise<string> {
    const balance = await this.contract.balanceOf(address);
    return ethers.formatUnits(balance, 18);
  }
  
  // Transferir bunz
  async transfer(to: string, amount: string): Promise<any> {
    if (!this.signer) throw new Error('Wallet not connected');
    
    const contractWithSigner = this.contract.connect(this.signer) as any;
    const tx = await contractWithSigner.transfer(to, ethers.parseUnits(amount, 18));
    return tx;
  }
  
  // Gastar bunz en un negocio (con fees)
  async spendAtBusiness(businessId: string, amount: string): Promise<any> {
    if (!this.signer) throw new Error('Wallet not connected');
    
    const contractWithSigner = this.contract.connect(this.signer) as any;
    const tx = await contractWithSigner.spendBunz(
      businessId,
      ethers.parseUnits(amount, 18)
    );
    return tx;
  }
  
  // Obtener crédito de un negocio
  async getBusinessCredit(businessId: string): Promise<{ limit: string; used: string }> {
    const [limit, used] = await this.contract.getBusinessCredit(businessId);
    return {
      limit: ethers.formatUnits(limit, 18),
      used: ethers.formatUnits(used, 18),
    };
  }
  
  // Obtener tasa de recompensa de un negocio
  async getBusinessRate(businessId: string): Promise<number> {
    const rate = await this.contract.getBusinessRate(businessId);
    return Number(rate) / 100; // Convertir de basis points a porcentaje
  }
  
  // Escuchar eventos
  onTransfer(callback: (from: string, to: string, amount: string) => void) {
    this.contract.on('Transfer', (from, to, amount) => {
      callback(from, to, ethers.formatUnits(amount, 18));
    });
  }
  
  onRewardMinted(callback: (business: string, user: string, amount: string) => void) {
    this.contract.on('RewardMinted', (business, user, _, rewardAmount) => {
      callback(business, user, ethers.formatUnits(rewardAmount, 18));
    });
  }
}

// Instancia singleton
export const bunzWallet = new BunzWallet();

// Helper para formatear montos
export function formatBunz(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Helper para parsear montos
export function parseBunz(amount: string): bigint {
  return ethers.parseUnits(amount, 18);
}
