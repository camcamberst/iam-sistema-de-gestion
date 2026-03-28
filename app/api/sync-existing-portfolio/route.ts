import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Sincronizando Portafolio de modelos existentes...');
    
    // 1. Obtener modelos con rol 'modelo'
    const { data: allModels, error: modelsError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'modelo');

    if (modelsError) {
      console.error('Error obteniendo modelos:', modelsError);
      return NextResponse.json({ success: false, error: modelsError.message }, { status: 500 });
    }

    if (!allModels || allModels.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay modelos en el sistema',
        synced: 0
      });
    }

    // 2. Obtener configuraciones activas de calculadora
    const { data: activeConfigs, error: configsError } = await supabase
      .from('calculator_config')
      .select('model_id, enabled_platforms, admin_id, created_at')
      .eq('active', true);

    if (configsError) {
      console.error('Error obteniendo configuraciones:', configsError);
      return NextResponse.json({ success: false, error: configsError.message }, { status: 500 });
    }

    // 3. Combinar modelos con sus configuraciones
    const modelsWithConfig = allModels
      .map(model => {
        const config = activeConfigs?.find(c => c.model_id === model.id);
        return config ? { ...model, calculator_config: [config] } : null;
      })
      .filter((model): model is NonNullable<typeof model> => model !== null);

    console.log('📋 Modelos encontrados con configuración:', modelsWithConfig.length);
    
    if (modelsWithConfig.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay modelos con configuración de calculadora',
        synced: 0
      });
    }
    
    // 4. Verificar cuáles ya tienen Portafolio
    const modelsToSync = [];
    
    for (const model of modelsWithConfig) {
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
      return NextResponse.json({ 
        success: true, 
        message: 'Todas las modelos ya tienen Portafolio sincronizado',
        synced: 0
      });
    }
    
    // 3. Crear Portafolio para cada modelo
    const results = [];
    
    for (const model of modelsToSync) {
      console.log(`🔄 Sincronizando Portafolio para: ${model.email}`);
      
      const config = model.calculator_config[0];
      const portfolioEntries = config.enabled_platforms.map((platformId: string) => ({
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
        results.push({
          email: model.email,
          success: false,
          error: insertError.message
        });
      } else {
        console.log(`✅ Portafolio creado para ${model.email} con ${portfolioEntries.length} plataformas`);
        results.push({
          email: model.email,
          success: true,
          platforms: portfolioEntries.length
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    console.log('🎉 Sincronización completada');
    
    return NextResponse.json({ 
      success: true, 
      message: `Sincronización completada. ${successCount}/${modelsToSync.length} modelos procesadas exitosamente`,
      results,
      synced: successCount
    });
    
  } catch (error: any) {
    console.error('❌ Error en sincronización:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
