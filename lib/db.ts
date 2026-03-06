import { neon } from '@neondatabase/serverless';

export default function db() {
  const url = process.env.DATABASE_URL || process.env.Database_Url;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(url);
}
