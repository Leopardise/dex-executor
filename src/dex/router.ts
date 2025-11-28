import { getEnv } from '../config/env';
import { raydiumQuote, raydiumExecute, RaydiumQuote } from './raydiumClient';
import { meteoraQuote, meteoraExecute, MeteoraQuote } from './meteoraClient';

export type Venue = 'raydium' | 'meteora';

export interface RouteDecision {
  venue: Venue;
  bestQuote: RaydiumQuote | MeteoraQuote;
}

export async function getBestRoute(
  inputMint: string,
  outputMint: string,
  amountInLamports: bigint
): Promise<RouteDecision> {
  const slippageBps = Number(getEnv('RAYDIUM_SLIPPAGE_BPS', '100'));
  const meteoraSlippage = Number(getEnv('METEORA_SLIPPAGE', '0.01'));

  const [rayQuote, metQuote] = await Promise.allSettled([
    raydiumQuote(inputMint, outputMint, amountInLamports, slippageBps),
    meteoraQuote(inputMint, outputMint, amountInLamports, meteoraSlippage)
  ]);

  if (rayQuote.status === 'rejected' && metQuote.status === 'rejected') {
    throw new Error(
      `Both DEX quote calls failed: ray=${rayQuote.reason}, met=${metQuote.reason}`
    );
  }

  const candidates: { venue: Venue; quote: RaydiumQuote | MeteoraQuote }[] = [];

  if (rayQuote.status === 'fulfilled') {
    candidates.push({ venue: 'raydium', quote: rayQuote.value });
  }
  if (metQuote.status === 'fulfilled') {
    candidates.push({ venue: 'meteora', quote: metQuote.value });
  }

  candidates.sort((a, b) => (a.quote.outAmount > b.quote.outAmount ? -1 : 1));

  const best = candidates[0];
  return { venue: best.venue, bestQuote: best.quote };
}

export async function executeOnVenue(
  venue: Venue,
  inputMint: string,
  outputMint: string,
  amountInLamports: bigint,
  quote: RaydiumQuote | MeteoraQuote
): Promise<string> {
  if (venue === 'raydium') {
    return raydiumExecute(inputMint, outputMint, amountInLamports, (quote as RaydiumQuote).swapResponse);
  } else {
    return meteoraExecute(quote as MeteoraQuote);
  }
}
