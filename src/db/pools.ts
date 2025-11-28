import { Pool } from 'pg';
import { getEnv } from '../config/env';

export const db = new Pool({
  host: getEnv('PG_HOST'),
  port: Number(getEnv('PG_PORT')),
  user: getEnv('PG_USER'),
  password: getEnv('PG_PASSWORD'),
  database: getEnv('PG_DATABASE')
});
