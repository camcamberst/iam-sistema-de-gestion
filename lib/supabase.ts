"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Valores por defecto hardcodeados para evitar problemas con variables de entorno
const DEFAULT_SUPABASE_URL = "https://mhernfrkvwigxdubiozm.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Función para obtener las variables de entorno de forma segura
function getSupabaseConfig() {
  // En el cliente, las variables NEXT_PUBLIC_* deberían estar disponibles
  // pero si no lo están, usamos los valores por defecto
  const supabaseUrl = 
    (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_SUPABASE_URL__) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL;
    
  const supabaseAnonKey = 
    (typeof window !== 'undefined' && (window as any).__NEXT_PUBLIC_SUPABASE_ANON_KEY__) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON) ||
    DEFAULT_SUPABASE_ANON_KEY;

  // Validar que las claves no estén vacías
  if (!supabaseUrl || supabaseUrl.trim() === '') {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing, using default');
    return { supabaseUrl: DEFAULT_SUPABASE_URL, supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY };
  }

  if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing, using default');
    return { supabaseUrl: DEFAULT_SUPABASE_URL, supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY };
  }

  return { supabaseUrl, supabaseAnonKey };
}

// Crear cliente de forma lazy para evitar problemas de inicialización
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    try {
      const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
      
      if (typeof window !== 'undefined') {
        console.log('🔍 Supabase Config:', { 
          supabaseUrl, 
          supabaseAnonKey: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'missing',
          hasUrl: !!supabaseUrl && supabaseUrl.trim() !== '',
          hasKey: !!supabaseAnonKey && supabaseAnonKey.trim() !== ''
        });
      }
      
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    } catch (error) {
      console.error('❌ Error creating Supabase client:', error);
      // Fallback: crear con valores por defecto
      supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    }
  }
  
  return supabaseInstance;
}

// Exportar como getter para que se inicialice solo cuando se accede
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});
