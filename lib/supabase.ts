"use client";
import { createClient } from "@supabase/supabase-js";

// Valores hardcodeados garantizados - estos son los valores reales de producción
const SUPABASE_URL = "https://mhernfrkvwigxdubiozm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c";

// Función para obtener la configuración solo en el cliente
function getConfig() {
  // Solo intentar leer variables de entorno si estamos en el cliente
  if (typeof window !== 'undefined') {
    // En el cliente, las variables NEXT_PUBLIC_* están disponibles en tiempo de build
    // pero pueden no estar en runtime, así que usamos los valores hardcodeados
    const envUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL);
    const envKey = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
                   (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON);
    
    return {
      url: (envUrl && envUrl.trim() !== '') ? envUrl : SUPABASE_URL,
      key: (envKey && envKey.trim() !== '') ? envKey : SUPABASE_ANON_KEY
    };
  }
  
  // Si no estamos en el cliente, usar valores hardcodeados
  return {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
  };
}

// Crear el cliente solo cuando se accede, no al importar
let clientInstance: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!clientInstance) {
    const config = getConfig();
    clientInstance = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  }
  return clientInstance;
}

// Exportar como objeto que inicializa el cliente solo cuando se accede
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});
