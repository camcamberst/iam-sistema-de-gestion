"use client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhernfrkvwigxdubiozm.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON || "";

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.log('🔍 Supabase Config:', { supabaseUrl, supabaseAnonKey: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'missing' });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
