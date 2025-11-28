import AmmImpl from '@meteora-ag/dynamic-amm-sdk';
import { BN } from 'bn.js';
import { PublicKey } from '@solana/web3.js';
import { getEnv } from '../config/env';
import { connection, owner } from '../config/solana';

export interface MeteoraQuote {
  venue: 'meteora';
  outAmount: bigint;
  // keep pool + quote so we can reuse it in execute
  pool: any;
  minOut: BN;
  inAmountLamports: BN;
}

export async function meteoraQuote(
  inputMint: string,
  outputMint: string,
  amountIn: bigint,
  slippage: number
): Promise<MeteoraQuote> {
  const poolPubkey = new PublicKey(getEnv('METEORA_POOL_PUBKEY'));

  // This load function depends on SDK; check exact name in your version
  const pool = await AmmImpl.loadPool(connection, poolPubkey);
  await pool.updateState();

  const inAmountLamports = new BN(amountIn.toString());
  const { minSwapOutAmount } = pool.getSwapQuote(
    new PublicKey(outputMint),
    inAmountLamports,
    slippage
  );

  return {
    venue: 'meteora',
    outAmount: BigInt(minSwapOutAmount.toString()),
    pool,
    minOut: minSwapOutAmount,
    inAmountLamports
  };
}

export async function meteoraExecute(
  quote: MeteoraQuote
): Promise<string> {
  const swapTx = await quote.pool.swap(
    owner.publicKey,
    new PublicKey(quote.pool.tokenB.address), // adjust depending on direction
    quote.inAmountLamports,
    quote.minOut
  );

  const txHash = await connection.sendTransaction(swapTx, [owner], {
    skipPreflight: true
  });

  await connection.confirmTransaction(txHash, 'confirmed');
  return txHash;
}
