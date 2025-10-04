const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://mhernfrkvwigxdubiozm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgxNjU0NywiZXhwIjoyMDc0MzkyNTQ3fQ.REPLACE_WITH_YOUR_ACTUAL_SERVICE_ROLE_KEY'
);

async function analyzeData() {
  console.log('🔍 [ANÁLISIS] Verificando datos en Supabase...');
  
  try {
    // 1. Verificar usuarios modelo
    console.log('\n📊 1. USUARIOS MODELO:');
    const { data: models, error: modelsError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('role', 'modelo')
      .limit(5);
    
    if (modelsError) {
      console.error('❌ Error al obtener modelos:', modelsError.message);
      return;
    }
    
    console.log('👥 Modelos encontrados:', models?.length || 0);
    if (models && models.length > 0) {
      console.log('👤 Primer modelo:', {
        id: models[0].id,
        name: models[0].name,
        email: models[0].email
      });
      
      const modelId = models[0].id;
      
      // 2. Verificar configuración de calculadora
      console.log('\n⚙️ 2. CONFIGURACIÓN DE CALCULADORA:');
      const { data: config, error: configError } = await supabase
        .from('calculator_config')
        .select('*')
        .eq('model_id', modelId)
        .eq('active', true)
        .single();
      
      if (configError && configError.code !== 'PGRST116') {
        console.error('❌ Error al obtener configuración:', configError.message);
      } else if (config) {
        console.log('✅ Configuración encontrada:', {
          enabled_platforms: config.enabled_platforms?.length || 0,
          percentage_override: config.percentage_override,
          group_percentage: config.group_percentage,
          min_quota_override: config.min_quota_override,
          group_min_quota: config.group_min_quota
        });
      } else {
        console.log('⚠️ No hay configuración para este modelo');
      }
      
      // 3. Verificar valores del modelo
      console.log('\n💾 3. VALORES DEL MODELO:');
      const { data: values, error: valuesError } = await supabase
        .from('model_values')
        .select('platform_id, value, period_date, created_at')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (valuesError) {
        console.error('❌ Error al obtener valores:', valuesError.message);
      } else {
        console.log('📊 Valores encontrados:', values?.length || 0);
        if (values && values.length > 0) {
          console.log('📈 Últimos valores:', values.slice(0, 3).map(v => ({
            platform_id: v.platform_id,
            value: v.value,
            period_date: v.period_date
          })));
        }
      }
      
      // 4. Verificar tasas
      console.log('\n💱 4. TASAS:');
      const { data: rates, error: ratesError } = await supabase
        .from('rates')
        .select('kind, value, active')
        .eq('active', true);
      
      if (ratesError) {
        console.error('❌ Error al obtener tasas:', ratesError.message);
      } else {
        console.log('📈 Tasas activas:', rates?.length || 0);
        if (rates && rates.length > 0) {
          console.log('💰 Tasas:', rates.map(r => ({
            kind: r.kind,
            value: r.value,
            active: r.active
          })));
        }
      }
      
      // 5. Verificar anticipos
      console.log('\n💰 5. ANTICIPOS:');
      const { data: anticipos, error: anticiposError } = await supabase
        .from('anticipos')
        .select('monto_solicitado, estado, created_at')
        .eq('model_id', modelId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (anticiposError) {
        console.error('❌ Error al obtener anticipos:', anticiposError.message);
      } else {
        console.log('💳 Anticipos encontrados:', anticipos?.length || 0);
        if (anticipos && anticipos.length > 0) {
          console.log('📋 Últimos anticipos:', anticipos.slice(0, 3).map(a => ({
            monto: a.monto_solicitado,
            estado: a.estado,
            fecha: a.created_at
          })));
        }
      }
      
    } else {
      console.log('⚠️ No hay modelos en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

analyzeData();
