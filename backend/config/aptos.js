import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import dotenv from 'dotenv';

dotenv.config();

const config = new AptosConfig({ 
  network: process.env.APTOS_NETWORK === 'mainnet' ? Network.MAINNET : Network.TESTNET 
});

export const aptos = new Aptos(config);
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
export const MODULE_NAME = process.env.MODULE_NAME;

console.log('✅ Aptos SDK initialized');
console.log(`📍 Network: ${process.env.APTOS_NETWORK}`);
console.log(`📍 Contract: ${CONTRACT_ADDRESS}`);
