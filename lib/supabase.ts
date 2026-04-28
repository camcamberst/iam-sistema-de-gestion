"use client";
import { createClient } from "@supabase/supabase-js";

// Valores hardcodeados garantizados - SIEMPRE usar estos valores
// Estos son los valores reales de producción y garantizan que el cliente se inicialice correctamente
const SUPABASE_URL = "https://mhernfrkvwigxdubiozm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Crear el cliente utilizando el patrón Singleton para evitar múltiples instancias
const getSupabaseClient = () => {
  if (typeof window !== "undefined") {
    // Asegurar una única instancia en el navegador usando window
    if (!(window as any).__supabase) {
      (window as any).__supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    }
    return (window as any).__supabase;
  }
  
  // En SSR/Node, crear una nueva instancia normalmente
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
};

export const supabase = getSupabaseClient();
