/**
 * 🗑️ SCRIPT: Eliminar Valores de P2 de Diciembre en Producción
 * 
 * Este script ejecuta el endpoint de eliminación en producción
 * Requiere autenticación de admin
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://iam-sistema-de-gestion.vercel.app';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Faltan variables de entorno');
  console.error('   Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function eliminarValoresProduccion() {
  console.log('\n🗑️ ELIMINACIÓN DE VALORES: P2 de Diciembre 2025');
  console.log('='.repeat(60));
  console.log(`🌐 URL de producción: ${API_URL}`);
  console.log('📅 Período: 16-31 de Diciembre 2025');
  console.log('='.repeat(60));

  try {
    // 1. Obtener un token de admin para autenticación
    console.log('\n📋 Paso 1: Obteniendo token de admin...');
    
    // Buscar un usuario admin
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('id, email, role')
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true)
      .limit(1)
      .single();

    if (adminError || !adminUser) {
      console.error('❌ Error: No se encontró un usuario admin activo');
      console.error('   Necesitas ejecutar este proceso desde la interfaz web con tu cuenta de admin');
      process.exit(1);
    }

    console.log(`✅ Usuario admin encontrado: ${adminUser.email}`);

    // 2. Crear una sesión para el admin (usando service role para obtener token)
    // Nota: En producción, esto debería hacerse a través de la interfaz web
    // Este script es solo para referencia - el proceso debe ejecutarse desde la UI
    
    console.log('\n⚠️ IMPORTANTE: Este script requiere autenticación interactiva.');
    console.log('   Para ejecutar en producción, usa la interfaz web:');
    console.log(`   1. Ve a: ${API_URL}/admin/emergency-archive-p2`);
    console.log('   2. Inicia sesión con tu cuenta de admin');
    console.log('   3. Haz clic en "🗑️ Eliminar Valores de Mi Calculadora"');
    console.log('\n   O ejecuta el endpoint directamente con tu token de sesión:');
    console.log(`   curl -X DELETE "${API_URL}/api/admin/emergency-archive-p2/delete" \\`);
    console.log('        -H "Authorization: Bearer TU_TOKEN_AQUI"');

    // 3. Mostrar estado actual
    console.log('\n📊 Estado actual del período P2 de diciembre:');
    const startDate = '2025-12-16';
    const endDate = '2025-12-31';
    const periodType = '16-31';
    const fechaLimite = new Date(`${endDate}T23:59:59.999Z`);
    const fechaLimiteISO = fechaLimite.toISOString();

    // Contar registros en calculator_history
    const { count: historyCount } = await supabase
      .from('calculator_history')
      .select('*', { count: 'exact', head: true })
      .eq('period_date', startDate)
      .eq('period_type', periodType);

    // Contar valores en model_values
    const { count: modelValuesCount } = await supabase
      .from('model_values')
      .select('*', { count: 'exact', head: true })
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .lte('updated_at', fechaLimiteISO);

    console.log(`   📦 Registros archivados (calculator_history): ${historyCount || 0}`);
    console.log(`   📊 Valores en calculadora (model_values): ${modelValuesCount || 0}`);

    if (historyCount > 0 && modelValuesCount > 0) {
      console.log('\n✅ Los valores están archivados y listos para eliminar');
      console.log('   Ejecuta el proceso desde la interfaz web para eliminarlos de forma segura');
    } else if (historyCount === 0) {
      console.log('\n⚠️ No hay registros archivados. Ejecuta el archivado primero.');
    } else {
      console.log('\n✅ No hay valores para eliminar (ya fueron eliminados o no existen)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

eliminarValoresProduccion()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });





