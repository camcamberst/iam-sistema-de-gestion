const { createClient } = require('@supabase/supabase-js');

// Usar variables de entorno de producción
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno no encontradas');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupMonthlyAvg() {
  try {
    console.log('🔄 Configurando promedio mensual de conexión en PRODUCCIÓN...');

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
    } else {
      console.log('✅ Columna monthly_connection_avg agregada');
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
    } else {
      console.log('✅ Columna last_avg_calculation_date agregada');
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
    } else {
      console.log('✅ Columna last_avg_month agregada');
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
    } else {
      console.log('✅ Función update_monthly_connection_avg creada');
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
    } else {
      console.log('✅ Función get_monthly_connection_avg creada');
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
    } else {
      console.log('✅ Verificación completada');
      console.log('📊 Columnas creadas:', columns);
    }

    console.log('🎉 ¡Configuración de promedio mensual completada en PRODUCCIÓN!');

  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

setupMonthlyAvg();
