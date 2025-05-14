
import { createMiddlewareClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase'; // Assuming you will generate this

export async function createSupabaseMiddlewareClient(
  req: NextRequest,
  res: NextResponse
) {
  return createMiddlewareClient<Database>(
    { req, res },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    }
  );
}
