import * as dotenv from 'dotenv';
dotenv.config();

export function getEnv(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
}
