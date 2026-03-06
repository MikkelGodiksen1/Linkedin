import { neon } from '@neondatabase/serverless';

export default function db() {
  return neon(process.env.DATABASE_URL!);
}
