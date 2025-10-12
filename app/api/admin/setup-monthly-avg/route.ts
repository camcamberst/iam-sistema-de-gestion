import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Configurar promedio mensual de conexión
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [SETUP-MONTHLY-AVG] Iniciando configuración de promedio mensual...');

    const results = [];

    // Paso 1: Agregar columna monthly_connection_avg
    console.log('📝 Paso 1: Agregando columna monthly_connection_avg...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS monthly_connection_avg DECIMAL(5,2) DEFAULT 0.00;
      `
    });
    
    if (error1) {
      console.error('❌ Error en paso 1:', error1);
      results.push({ step: 1, success: false, error: error1.message });
    } else {
      console.log('✅ Columna monthly_connection_avg agregada');
      results.push({ step: 1, success: true, message: 'Columna monthly_connection_avg agregada' });
    }

    // Paso 2: Agregar columna last_avg_calculation_date
    console.log('📝 Paso 2: Agregando columna last_avg_calculation_date...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS last_avg_calculation_date DATE DEFAULT NULL;
      `
    });
    
    if (error2) {
      console.error('❌ Error en paso 2:', error2);
      results.push({ step: 2, success: false, error: error2.message });
    } else {
      console.log('✅ Columna last_avg_calculation_date agregada');
      results.push({ step: 2, success: true, message: 'Columna last_avg_calculation_date agregada' });
    }

    // Paso 3: Agregar columna last_avg_month
    console.log('📝 Paso 3: Agregando columna last_avg_month...');
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE public.users 
        ADD COLUMN IF NOT EXISTS last_avg_month VARCHAR(7) DEFAULT NULL;
      `
    });
    
    if (error3) {
      console.error('❌ Error en paso 3:', error3);
      results.push({ step: 3, success: false, error: error3.message });
    } else {
      console.log('✅ Columna last_avg_month agregada');
      results.push({ step: 3, success: true, message: 'Columna last_avg_month agregada' });
    }

    // Paso 4: Crear función update_monthly_connection_avg
    console.log('📝 Paso 4: Creando función update_monthly_connection_avg...');
    const { error: error4 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION update_monthly_connection_avg(p_model_id UUID)
        RETURNS DECIMAL(5,2) AS $$
        DECLARE
            current_month VARCHAR(7);
            current_date_str DATE;
            days_in_month INTEGER;
            days_with_activity INTEGER;
            monthly_avg DECIMAL(5,2);
        BEGIN
            current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
            current_date_str := CURRENT_DATE;
            
            days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('MONTH', CURRENT_DATE) + INTERVAL '1 MONTH - 1 DAY'));
            
            SELECT COUNT(DISTINCT period_date) INTO days_with_activity
            FROM calculator_history 
            WHERE model_id = p_model_id 
            AND DATE_TRUNC('MONTH', period_date::DATE) = DATE_TRUNC('MONTH', CURRENT_DATE);
            
            monthly_avg := CASE 
                WHEN days_in_month > 0 THEN ROUND((days_with_activity::DECIMAL / 26) * 100, 2)
                ELSE 0
            END;
            
            UPDATE public.users 
            SET 
                monthly_connection_avg = monthly_avg,
                last_avg_calculation_date = current_date_str,
                last_avg_month = current_month
            WHERE id = p_model_id;
            
            RETURN monthly_avg;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error4) {
      console.error('❌ Error en paso 4:', error4);
      results.push({ step: 4, success: false, error: error4.message });
    } else {
      console.log('✅ Función update_monthly_connection_avg creada');
      results.push({ step: 4, success: true, message: 'Función update_monthly_connection_avg creada' });
    }

    // Paso 5: Crear función get_monthly_connection_avg
    console.log('📝 Paso 5: Creando función get_monthly_connection_avg...');
    const { error: error5 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION get_monthly_connection_avg(p_model_id UUID)
        RETURNS DECIMAL(5,2) AS $$
        DECLARE
            current_month VARCHAR(7);
            last_calculated_month VARCHAR(7);
            monthly_avg DECIMAL(5,2);
        BEGIN
            current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
            
            SELECT last_avg_month INTO last_calculated_month
            FROM public.users 
            WHERE id = p_model_id;
            
            IF last_calculated_month IS NULL OR last_calculated_month != current_month THEN
                monthly_avg := update_monthly_connection_avg(p_model_id);
            ELSE
                SELECT monthly_connection_avg INTO monthly_avg
                FROM public.users 
                WHERE id = p_model_id;
            END IF;
            
            RETURN COALESCE(monthly_avg, 0);
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error5) {
      console.error('❌ Error en paso 5:', error5);
      results.push({ step: 5, success: false, error: error5.message });
    } else {
      console.log('✅ Función get_monthly_connection_avg creada');
      results.push({ step: 5, success: true, message: 'Función get_monthly_connection_avg creada' });
    }

    // Verificar que todo se creó correctamente
    console.log('🔍 Verificando estructura...');
    const { data: columns, error: verifyError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        AND column_name IN ('monthly_connection_avg', 'last_avg_calculation_date', 'last_avg_month')
        ORDER BY column_name;
      `
    });

    if (verifyError) {
      console.error('❌ Error verificando:', verifyError);
      results.push({ step: 'verification', success: false, error: verifyError.message });
    } else {
      console.log('✅ Verificación completada');
      results.push({ step: 'verification', success: true, message: 'Verificación completada', columns });
    }

    const successCount = results.filter(r => r.success).length;
    const totalSteps = results.length;

    console.log(`🎉 ¡Configuración completada! ${successCount}/${totalSteps} pasos exitosos`);

    return NextResponse.json({
      success: successCount === totalSteps,
      message: `Configuración de promedio mensual completada: ${successCount}/${totalSteps} pasos exitosos`,
      results,
      columns: columns || null
    });

  } catch (error: any) {
    console.error('❌ [SETUP-MONTHLY-AVG] Error general:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

// GET: Verificar estado de la configuración
export async function GET(request: NextRequest) {
  try {
    const { data: columns, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND table_schema = 'public'
        AND column_name IN ('monthly_connection_avg', 'last_avg_calculation_date', 'last_avg_month')
        ORDER BY column_name;
      `
    });

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error al verificar configuración' 
      }, { status: 500 });
    }

    const isConfigured = columns && columns.length === 3;

    return NextResponse.json({
      success: true,
      isConfigured,
      columns: columns || [],
      message: isConfigured 
        ? 'Promedio mensual ya está configurado' 
        : 'Promedio mensual no está configurado'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
