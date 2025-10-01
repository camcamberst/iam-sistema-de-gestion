/**
 * 🏗️ SINGLETON SUPABASE CLIENT
 * 
 * Cliente único de Supabase para evitar múltiples instancias
 * y prevenir bucles infinitos en la aplicación.
 */

"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verificar configuración
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase configuration missing. Check environment variables.');
}

// Asegurar que las variables no sean undefined
const SUPABASE_URL = supabaseUrl as string;
const SUPABASE_ANON_KEY = supabaseAnonKey as string;
const SERVICE_ROLE_KEY = serviceRoleKey as string;

// Singleton para cliente anónimo
let supabaseInstance: SupabaseClient | null = null;

// Singleton para cliente admin
let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * Obtener cliente Supabase anónimo (singleton)
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    console.log('🔧 [SUPABASE] Creating singleton client');
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseInstance;
}

/**
 * Obtener cliente Supabase admin (singleton)
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminInstance) {
    if (!SERVICE_ROLE_KEY) {
      throw new Error('❌ Service role key missing for admin client');
    }
    console.log('🔧 [SUPABASE] Creating singleton admin client');
    supabaseAdminInstance = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminInstance;
}

/**
 * Limpiar instancias (para testing)
 */
export function clearSupabaseInstances(): void {
  supabaseInstance = null;
  supabaseAdminInstance = null;
  console.log('🔧 [SUPABASE] Instances cleared');
}

// Exportar instancias por compatibilidad
export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();
