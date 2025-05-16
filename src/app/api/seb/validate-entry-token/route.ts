
// src/app/api/seb/validate-entry-token/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Initialize Supabase client with service role for direct DB access
// Ensure these are set in your Vercel/Netlify environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key for backend operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL: Supabase URL or Service Key missing for API route.");
}

// Initialize Supabase client (this instance is scoped to this module)
// We use createClient from supabase-js directly for server-side operations
// that require elevated privileges or don't involve user sessions in the traditional sense.
const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceKey) 
  : null;

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid token provided.' }, { status: 400 });
    }

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('SebEntryTokens')
      .select('student_user_id, exam_id, status, expires_at')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.warn(`[API Validate Token] Token not found or DB error for token ${token}:`, tokenError?.message);
      return NextResponse.json({ error: 'Invalid or expired entry token. DBError:' + tokenError?.message }, { status: 404 });
    }

    if (tokenData.status !== 'pending') {
      return NextResponse.json({ error: 'Entry token has already been used or invalidated.' }, { status: 403 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      // Optionally update status to 'expired'
      await supabaseAdmin.from('SebEntryTokens').update({ status: 'expired' }).eq('token', token);
      return NextResponse.json({ error: 'Entry token has expired.' }, { status: 403 });
    }

    // Mark token as claimed
    const { error: updateError } = await supabaseAdmin
      .from('SebEntryTokens')
      .update({ status: 'claimed' })
      .eq('token', token);

    if (updateError) {
      console.error(`[API Validate Token] Failed to update token status for ${token}:`, updateError.message);
      return NextResponse.json({ error: 'Failed to process token.' }, { status: 500 });
    }

    return NextResponse.json({
      student_user_id: tokenData.student_user_id,
      exam_id: tokenData.exam_id,
    }, { status: 200 });

  } catch (e: any) {
    console.error('[API Validate Token] Exception:', e.message);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
