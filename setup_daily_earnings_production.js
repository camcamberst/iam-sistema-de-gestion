// Script para ejecutar el SQL de daily_earnings en producción
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase (usar las variables de entorno de producción)
const supabaseUrl = 'https://your-project.supabase.co'; // Reemplazar con tu URL real
const supabaseServiceKey = 'your-service-role-key'; // Reemplazar con tu service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDailyEarnings() {
  try {
    console.log('🚀 Iniciando configuración de daily_earnings...');

    // Leer el archivo SQL
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./create_daily_earnings_table.sql', 'utf8');

    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('❌ Error ejecutando SQL:', error);
      return;
    }

    console.log('✅ Tabla daily_earnings creada exitosamente');
    console.log('📊 Estructura:');
    console.log('   - id: UUID (PK)');
    console.log('   - model_id: UUID (FK a auth.users)');
    console.log('   - earnings_date: DATE');
    console.log('   - earnings_amount: DECIMAL(10,2)');
    console.log('   - created_at, updated_at: TIMESTAMP');
    console.log('   - UNIQUE constraint en (model_id, earnings_date)');
    console.log('   - RLS habilitado con políticas para modelos y admins');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  setupDailyEarnings();
}

module.exports = { setupDailyEarnings };
