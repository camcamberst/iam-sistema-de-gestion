import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Sincronizando Portafolio de modelos existentes...');
    
    // 1. Verificar qué modelos tienen configuración pero no tienen Portafolio
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
      return NextResponse.json({ success: false, error: checkError.message }, { status: 500 });
    }
    
    console.log('📋 Modelos encontrados con configuración:', modelsNeedingSync?.length || 0);
    
    if (!modelsNeedingSync || modelsNeedingSync.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay modelos con configuración de calculadora',
        synced: 0
      });
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
