import axios from 'axios';
import { Transaction, VersionedTransaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getEnv } from '../config/env';
import { connection, owner } from '../config/solana';
import { NATIVE_MINT } from '@solana/spl-token';
import { API_URLS } from '@raydium-io/raydium-sdk-v2';

interface SwapCompute {
  // minimal fields we need
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface RaydiumQuote {
  venue: 'raydium';
  outAmount: bigint;
  swapResponse: SwapCompute;
}

export async function raydiumQuote(
  inputMint: string,
  outputMint: string,
  amountIn: bigint,
  slippageBps: number
): Promise<RaydiumQuote> {
  const txVersion = getEnv('RAYDIUM_TX_VERSION', 'V0');
  const url = `${API_URLS.SWAP_HOST}/compute/swap-base-in` +
    `?inputMint=${inputMint}` +
    `&outputMint=${outputMint}` +
    `&amount=${amountIn.toString()}` +
    `&slippageBps=${slippageBps}` +
    `&txVersion=${txVersion}`;

  const { data: swapResponse } = await axios.get<SwapCompute>(url);

  const outAmount = BigInt(swapResponse.data.outputAmount ?? swapResponse.data.amountOut ?? 0);

  return {
    venue: 'raydium',
    outAmount,
    swapResponse
  };
}

export async function raydiumExecute(
  inputMint: string,
  outputMint: string,
  amountIn: bigint,
  swapResponse: SwapCompute
): Promise<string> {
  const txVersion = getEnv('RAYDIUM_TX_VERSION', 'V0');
  const isV0Tx = txVersion === 'V0';

  // priority fee from Raydium API
  const { data: feeData } = await axios.get<{
    id: string;
    success: boolean;
    data: { default: { vh: number; h: number; m: number } };
  }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);

  // TODO: if inputMint != SOL, fetch token accounts (omitted: you'll add fetchTokenAccountData)
  const isInputSol = inputMint === NATIVE_MINT.toBase58();
  const isOutputSol = outputMint === NATIVE_MINT.toBase58();

  const { data: swapTransactions } = await axios.post<{
    id: string;
    version: string;
    success: boolean;
    data: { transaction: string }[];
  }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
    computeUnitPriceMicroLamports: String(feeData.data.default.h),
    swapResponse,
    txVersion,
    wallet: owner.publicKey.toBase58(),
    wrapSol: isInputSol,
    unwrapSol: isOutputSol,
    inputAccount: undefined,   // use default ATA in this simplified version
    outputAccount: undefined   // use default ATA
  });

  const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'));
  const allTransactions = allTxBuf.map((txBuf) =>
    isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
  );

  let lastTxId = '';

  if (!isV0Tx) {
    for (const tx of allTransactions) {
      const transaction = tx as Transaction;
      transaction.sign(owner);
      lastTxId = await sendAndConfirmTransaction(connection, transaction, [owner], {
        skipPreflight: true
      });
    }
  } else {
    for (const tx of allTransactions) {
      const transaction = tx as VersionedTransaction;
      transaction.sign([owner]);
      const txId = await connection.sendTransaction(transaction, { skipPreflight: true });
      const { lastValidBlockHeight, blockhash } = await connection.getLatestBlockhash({
        commitment: 'finalized'
      });
      await connection.confirmTransaction(
        {
          blockhash,
          lastValidBlockHeight,
          signature: txId
        },
        'confirmed'
      );
      lastTxId = txId;
    }
  }

  return lastTxId;
}
