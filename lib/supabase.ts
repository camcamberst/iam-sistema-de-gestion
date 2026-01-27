"use client";
import { createClient } from "@supabase/supabase-js";

// Obtener variables de entorno con valores por defecto
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhernfrkvwigxdubiozm.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Validar que las claves no estén vacías
if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.log('🔍 Supabase Config:', { 
    supabaseUrl, 
    supabaseAnonKey: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'missing',
    hasUrl: !!supabaseUrl && supabaseUrl.trim() !== '',
    hasKey: !!supabaseAnonKey && supabaseAnonKey.trim() !== ''
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
