import { PushChain } from '@pushchain/core';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Push Chain Network Configuration
const PUSH_NETWORK = process.env.PUSH_NETWORK === 'mainnet' 
  ? PushChain.CONSTANTS.PUSH_NETWORK.MAINNET 
  : PushChain.CONSTANTS.PUSH_NETWORK.TESTNET;

// RPC URL for Push Chain
const PUSH_RPC_URL = process.env.PUSH_RPC_URL || 'https://evm.donut.rpc.push.org/';

// Contract addresses (update after deployment)
export const GAME_NFT_CONTRACT = process.env.GAME_NFT_CONTRACT;
export const MULTIPLAYER_GAME_CONTRACT = process.env.MULTIPLAYER_GAME_CONTRACT;

// Initialize provider for reading blockchain state
export const provider = new ethers.JsonRpcProvider(PUSH_RPC_URL);

// Function to initialize Push Chain client with a signer
export async function initializePushChainClient(privateKey) {
  try {
    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Convert to Universal Signer
    const universalSigner = await PushChain.utils.signer.toUniversal(wallet);
    
    // Initialize Push Chain Client
    const pushChainClient = await PushChain.initialize(universalSigner, {
      network: PUSH_NETWORK,
    });
    
    console.log('✅ Push Chain SDK initialized');
    console.log(`📍 Network: ${PUSH_NETWORK}`);
    console.log(`📍 RPC URL: ${PUSH_RPC_URL}`);
    console.log(`📍 Wallet: ${wallet.address}`);
    
    return pushChainClient;
  } catch (error) {
    console.error('❌ Failed to initialize Push Chain client:', error);
    throw error;
  }
}

// Export network and RPC info
export const pushChainConfig = {
  network: PUSH_NETWORK,
  rpcUrl: PUSH_RPC_URL,
  provider,
};

console.log('✅ Push Chain config loaded');
console.log(`📍 Network: ${PUSH_NETWORK}`);
console.log(`📍 RPC URL: ${PUSH_RPC_URL}`);
