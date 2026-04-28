import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// POST: Configurar tabla de promedio diario quincenal
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [SETUP-DAILY-AVG-QUINCENAL] Iniciando configuración...');

    const results = [];

    // Paso 1: Crear tabla platform_quincenal_stats
    console.log('📝 Paso 1: Creando tabla platform_quincenal_stats...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS platform_quincenal_stats (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          platform_id VARCHAR(50) NOT NULL,
          quincena VARCHAR(7) NOT NULL,
          daily_avg_usd DECIMAL(8,2) NOT NULL DEFAULT 0.00,
          total_days INTEGER NOT NULL DEFAULT 0,
          total_usd_modelo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(model_id, platform_id, quincena)
        );
      `
    });
    
    if (error1) {
      console.error('❌ Error en paso 1:', error1);
      results.push({ step: 1, success: false, error: error1.message });
    } else {
      console.log('✅ Tabla platform_quincenal_stats creada');
      results.push({ step: 1, success: true, message: 'Tabla platform_quincenal_stats creada' });
    }

    // Paso 2: Crear índices
    console.log('📝 Paso 2: Creando índices...');
    const { error: error2 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_model_id ON platform_quincenal_stats(model_id);
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_platform_id ON platform_quincenal_stats(platform_id);
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_quincena ON platform_quincenal_stats(quincena);
        CREATE INDEX IF NOT EXISTS idx_platform_quincenal_stats_created_at ON platform_quincenal_stats(created_at);
      `
    });
    
    if (error2) {
      console.error('❌ Error en paso 2:', error2);
      results.push({ step: 2, success: false, error: error2.message });
    } else {
      console.log('✅ Índices creados');
      results.push({ step: 2, success: true, message: 'Índices creados' });
    }

    // Paso 3: Crear trigger para updated_at
    console.log('📝 Paso 3: Creando trigger...');
    const { error: error3 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION update_platform_quincenal_stats_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trigger_update_platform_quincenal_stats_updated_at ON platform_quincenal_stats;
        CREATE TRIGGER trigger_update_platform_quincenal_stats_updated_at
          BEFORE UPDATE ON platform_quincenal_stats
          FOR EACH ROW
          EXECUTE FUNCTION update_platform_quincenal_stats_updated_at();
      `
    });
    
    if (error3) {
      console.error('❌ Error en paso 3:', error3);
      results.push({ step: 3, success: false, error: error3.message });
    } else {
      console.log('✅ Trigger creado');
      results.push({ step: 3, success: true, message: 'Trigger creado' });
    }

    // Paso 4: Crear función calculate_quincenal_stats
    console.log('📝 Paso 4: Creando función calculate_quincenal_stats...');
    const { error: error4 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION calculate_quincenal_stats(
          p_model_id UUID,
          p_platform_id VARCHAR(50),
          p_quincena VARCHAR(7)
        )
        RETURNS TABLE(
          daily_avg DECIMAL(8,2),
          total_days INTEGER,
          total_usd DECIMAL(10,2)
        ) AS $$
        DECLARE
          period_start_date DATE;
          period_end_date DATE;
          year_part INTEGER;
          month_part INTEGER;
          quincena_part INTEGER;
        BEGIN
          year_part := CAST(SPLIT_PART(p_quincena, '-', 1) AS INTEGER);
          month_part := CAST(SPLIT_PART(p_quincena, '-', 2) AS INTEGER);
          quincena_part := CAST(SPLIT_PART(p_quincena, '-', 3) AS INTEGER);
          
          IF quincena_part = 1 THEN
            period_start_date := DATE(year_part, month_part, 1);
            period_end_date := DATE(year_part, month_part, 15);
          ELSE
            period_start_date := DATE(year_part, month_part, 16);
            period_end_date := DATE(year_part, month_part, EXTRACT(DAY FROM (DATE(year_part, month_part, 1) + INTERVAL '1 MONTH - 1 DAY')));
          END IF;
          
          RETURN QUERY
          SELECT 
            CASE 
              WHEN COUNT(DISTINCT ch.period_date) > 0 
              THEN ROUND(SUM(ch.usd_modelo) / COUNT(DISTINCT ch.period_date), 2)
              ELSE 0.00
            END as daily_avg,
            COUNT(DISTINCT ch.period_date)::INTEGER as total_days,
            COALESCE(SUM(ch.usd_modelo), 0.00) as total_usd
          FROM calculator_history ch
          WHERE ch.model_id = p_model_id
            AND ch.platform_id = p_platform_id
            AND ch.period_date::DATE >= period_start_date
            AND ch.period_date::DATE <= period_end_date;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error4) {
      console.error('❌ Error en paso 4:', error4);
      results.push({ step: 4, success: false, error: error4.message });
    } else {
      console.log('✅ Función calculate_quincenal_stats creada');
      results.push({ step: 4, success: true, message: 'Función calculate_quincenal_stats creada' });
    }

    // Paso 5: Crear función update_quincenal_stats
    console.log('📝 Paso 5: Creando función update_quincenal_stats...');
    const { error: error5 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION update_quincenal_stats(
          p_model_id UUID,
          p_platform_id VARCHAR(50),
          p_quincena VARCHAR(7)
        )
        RETURNS VOID AS $$
        DECLARE
          stats_record RECORD;
          period_start_date DATE;
          period_end_date DATE;
          year_part INTEGER;
          month_part INTEGER;
          quincena_part INTEGER;
        BEGIN
          year_part := CAST(SPLIT_PART(p_quincena, '-', 1) AS INTEGER);
          month_part := CAST(SPLIT_PART(p_quincena, '-', 2) AS INTEGER);
          quincena_part := CAST(SPLIT_PART(p_quincena, '-', 3) AS INTEGER);
          
          IF quincena_part = 1 THEN
            period_start_date := DATE(year_part, month_part, 1);
            period_end_date := DATE(year_part, month_part, 15);
          ELSE
            period_start_date := DATE(year_part, month_part, 16);
            period_end_date := DATE(year_part, month_part, EXTRACT(DAY FROM (DATE(year_part, month_part, 1) + INTERVAL '1 MONTH - 1 DAY')));
          END IF;
          
          SELECT * INTO stats_record
          FROM calculate_quincenal_stats(p_model_id, p_platform_id, p_quincena);
          
          INSERT INTO platform_quincenal_stats (
            model_id, platform_id, quincena, daily_avg_usd, 
            total_days, total_usd_modelo, period_start, period_end
          ) VALUES (
            p_model_id, p_platform_id, p_quincena, stats_record.daily_avg,
            stats_record.total_days, stats_record.total_usd, period_start_date, period_end_date
          )
          ON CONFLICT (model_id, platform_id, quincena)
          DO UPDATE SET
            daily_avg_usd = EXCLUDED.daily_avg_usd,
            total_days = EXCLUDED.total_days,
            total_usd_modelo = EXCLUDED.total_usd_modelo,
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            updated_at = NOW();
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error5) {
      console.error('❌ Error en paso 5:', error5);
      results.push({ step: 5, success: false, error: error5.message });
    } else {
      console.log('✅ Función update_quincenal_stats creada');
      results.push({ step: 5, success: true, message: 'Función update_quincenal_stats creada' });
    }

    // Paso 6: Crear función get_moving_average_daily_avg (progresiva)
    console.log('📝 Paso 6: Creando función get_moving_average_daily_avg...');
    const { error: error6 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION get_moving_average_daily_avg(
          p_model_id UUID,
          p_platform_id VARCHAR(50),
          p_quincenas_back INTEGER DEFAULT 4
        )
        RETURNS TABLE(
          current_avg DECIMAL(8,2),
          previous_avg DECIMAL(8,2),
          trend VARCHAR(1),
          quincenas_count INTEGER
        ) AS $$
        DECLARE
          current_avg_val DECIMAL(8,2);
          previous_avg_val DECIMAL(8,2);
          trend_char VARCHAR(1);
          count_val INTEGER;
          available_quincenas INTEGER;
        BEGIN
          -- Contar quincenas disponibles
          SELECT COUNT(*) INTO available_quincenas
          FROM platform_quincenal_stats
          WHERE model_id = p_model_id
            AND platform_id = p_platform_id;
          
          -- Si no hay datos, retornar 0
          IF available_quincenas = 0 THEN
            RETURN QUERY SELECT 0.00, 0.00, '=', 0;
            RETURN;
          END IF;
          
          -- Determinar cuántas quincenas usar (progresivo)
          DECLARE
            quincenas_to_use INTEGER;
          BEGIN
            IF available_quincenas >= 4 THEN
              quincenas_to_use := 4; -- Promedio móvil de 4 quincenas
            ELSE
              quincenas_to_use := available_quincenas; -- Todas las disponibles
            END IF;
            
            -- Obtener promedio de las quincenas disponibles
            SELECT 
              ROUND(AVG(daily_avg_usd), 2),
              quincenas_to_use
            INTO current_avg_val, count_val
            FROM platform_quincenal_stats
            WHERE model_id = p_model_id
              AND platform_id = p_platform_id
            ORDER BY quincena DESC
            LIMIT quincenas_to_use;
            
            -- Para tendencia, comparar con el período anterior
            IF available_quincenas >= 2 THEN
              -- Si hay 2+ quincenas, comparar con la quincena anterior
              SELECT ROUND(AVG(daily_avg_usd), 2)
              INTO previous_avg_val
              FROM platform_quincenal_stats
              WHERE model_id = p_model_id
                AND platform_id = p_platform_id
              ORDER BY quincena DESC
              OFFSET 1
              LIMIT 1;
            ELSE
              -- Si solo hay 1 quincena, no hay tendencia
              previous_avg_val := NULL;
            END IF;
            
            -- Determinar tendencia
            IF previous_avg_val IS NULL THEN
              trend_char := '=';
            ELSIF current_avg_val > previous_avg_val THEN
              trend_char := '↑';
            ELSIF current_avg_val < previous_avg_val THEN
              trend_char := '↓';
            ELSE
              trend_char := '=';
            END IF;
            
            RETURN QUERY SELECT 
              COALESCE(current_avg_val, 0.00),
              COALESCE(previous_avg_val, 0.00),
              trend_char,
              count_val;
          END;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error6) {
      console.error('❌ Error en paso 6:', error6);
      results.push({ step: 6, success: false, error: error6.message });
    } else {
      console.log('✅ Función get_moving_average_daily_avg creada');
      results.push({ step: 6, success: true, message: 'Función get_moving_average_daily_avg creada' });
    }

    // Paso 7: Configurar RLS
    console.log('📝 Paso 7: Configurando RLS...');
    const { error: error7 } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE platform_quincenal_stats ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Models can view own quincenal stats" ON platform_quincenal_stats;
        CREATE POLICY "Models can view own quincenal stats" ON platform_quincenal_stats
          FOR SELECT USING (auth.uid() = model_id);
        
        DROP POLICY IF EXISTS "Admins can manage quincenal stats" ON platform_quincenal_stats;
        CREATE POLICY "Admins can manage quincenal stats" ON platform_quincenal_stats
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.users 
              WHERE id = auth.uid() 
              AND role IN ('admin', 'super_admin')
            )
          );
      `
    });
    
    if (error7) {
      console.error('❌ Error en paso 7:', error7);
      results.push({ step: 7, success: false, error: error7.message });
    } else {
      console.log('✅ RLS configurado');
      results.push({ step: 7, success: true, message: 'RLS configurado' });
    }

    // Verificar que todo se creó correctamente
    console.log('🔍 Verificando estructura...');
    const { data: columns, error: verifyError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'platform_quincenal_stats'
        ORDER BY ordinal_position;
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
      message: `Configuración de promedio diario quincenal completada: ${successCount}/${totalSteps} pasos exitosos`,
      results,
      columns: columns || null
    });

  } catch (error: any) {
    console.error('❌ [SETUP-DAILY-AVG-QUINCENAL] Error general:', error);
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
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'platform_quincenal_stats'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'Error al verificar configuración' 
      }, { status: 500 });
    }

    const isConfigured = columns && columns.length > 0;

    return NextResponse.json({
      success: true,
      isConfigured,
      columns: columns || [],
      message: isConfigured 
        ? 'Promedio diario quincenal ya está configurado' 
        : 'Promedio diario quincenal no está configurado'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
