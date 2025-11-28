import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getEnv } from './env';

export const connection = new Connection(getEnv('SOLANA_RPC_URL'), 'confirmed');

export const owner = Keypair.fromSecretKey(
  bs58.decode(getEnv('SOLANA_WALLET_SECRET_KEY'))
);
