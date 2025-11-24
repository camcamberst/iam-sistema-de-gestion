require('dotenv').config({ path: '.env.local' });

console.log('🔍 Verificando variables de entorno...');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Presente' : '❌ Faltante');
console.log('Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Presente' : '❌ Faltante');
console.log('Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Presente' : '❌ Faltante');

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('Service Role Key longitud:', process.env.SUPABASE_SERVICE_ROLE_KEY.length);
    // Comparar primeros 5 chars con anon key para ver si son iguales (error común)
    const anonStart = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0,5);
    const serviceStart = process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0,5);
    if (anonStart && serviceStart && anonStart === serviceStart) {
        console.warn('⚠️ ALERTA: La Service Role Key parece ser igual a la Anon Key (empiezan igual). Esto causará fallos de permisos.');
    }
}



