const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde env.modern
function loadEnvFile() {
  const envPath = path.join(__dirname, 'env.modern');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

loadEnvFile();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncExistingModelPortfolio() {
  try {
    console.log('🔍 Verificando modelos con configuración pero sin Portafolio...');
    
    // 1. Verificar qué modelos necesitan sincronización
    const { data: modelsNeedingSync, error: checkError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        calculator_config!inner(
          enabled_platforms,
          admin_id,
          created_at
        )
      `)
      .eq('role', 'modelo')
      .eq('calculator_config.active', true);

    if (checkError) {
      console.error('Error verificando modelos:', checkError);
      return;
    }
    
    console.log('📋 Modelos encontrados con configuración:', modelsNeedingSync?.length || 0);
    
    if (!modelsNeedingSync || modelsNeedingSync.length === 0) {
      console.log('✅ No hay modelos con configuración de calculadora');
      return;
    }
    
    // 2. Verificar cuáles ya tienen Portafolio
    const modelsToSync = [];
    
    for (const model of modelsNeedingSync) {
      const { data: existingPortfolio, error: portfolioError } = await supabase
        .from('modelo_plataformas')
        .select('id')
        .eq('model_id', model.id)
        .limit(1);
      
      if (portfolioError) {
        console.error(`Error verificando Portafolio de ${model.email}:`, portfolioError);
        continue;
      }
      
      if (!existingPortfolio || existingPortfolio.length === 0) {
        modelsToSync.push(model);
      } else {
        console.log(`✅ ${model.email} ya tiene Portafolio`);
      }
    }
    
    console.log(`🔄 Modelos que necesitan sincronización: ${modelsToSync.length}`);
    
    if (modelsToSync.length === 0) {
      console.log('✅ Todas las modelos ya tienen Portafolio sincronizado');
      return;
    }
    
    // 3. Crear Portafolio para cada modelo
    for (const model of modelsToSync) {
      console.log(`🔄 Sincronizando Portafolio para: ${model.email}`);
      
      const config = model.calculator_config[0];
      const portfolioEntries = config.enabled_platforms.map(platformId => ({
        model_id: model.id,
        platform_id: platformId,
        status: 'entregada',
        is_initial_config: true,
        requested_at: config.created_at,
        delivered_at: config.created_at,
        requested_by: config.admin_id,
        delivered_by: config.admin_id,
        notes: 'Sincronización automática de configuración existente'
      }));
      
      const { error: insertError } = await supabase
        .from('modelo_plataformas')
        .insert(portfolioEntries);
      
      if (insertError) {
        console.error(`❌ Error sincronizando ${model.email}:`, insertError);
      } else {
        console.log(`✅ Portafolio creado para ${model.email} con ${portfolioEntries.length} plataformas`);
      }
    }
    
    console.log('🎉 Sincronización completada');
    
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
  }
}

syncExistingModelPortfolio();
