import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [CLEAN-HISTORY-AUTH] Iniciando limpieza autenticada...');
    
    // Obtener el token de autorización del header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Token de autorización requerido'
      }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Crear cliente Supabase con el token del usuario
    const supabase = createClient(
      'https://mhernfrkvwigxdubiozm.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZXJuZnJrdndpZ3hkdWJpb3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTY1NDcsImV4cCI6MjA3NDM5MjU0N30.v7qBceGTwaqyDZe5h9yLBjWwuuGEwAq6KVsAH_RNw8c',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
    
    // Verificar que el usuario esté autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no autenticado'
      }, { status: 401 });
    }
    
    console.log(`🔍 [CLEAN-HISTORY-AUTH] Usuario autenticado: ${user.id}`);
    
    // 0. Verificar estado ANTES de la limpieza
    console.log('\n📊 [CLEAN-HISTORY-AUTH] 0. Verificando estado ANTES de la limpieza:');
    const { data: beforeData, error: beforeError } = await supabase
      .from('calculator_history')
      .select('period_type, value, model_id');
    
    if (beforeError) {
      console.error('❌ Error obteniendo datos antes de limpieza:', beforeError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo datos antes de limpieza'
      }, { status: 500 });
    }
    
    const beforeSummary: Record<string, any> = {};
    beforeData?.forEach(record => {
      if (!beforeSummary[record.period_type]) {
        beforeSummary[record.period_type] = {
          registros: 0,
          modelos: new Set(),
          total_valor: 0
        };
      }
      beforeSummary[record.period_type].registros++;
      beforeSummary[record.period_type].modelos.add(record.model_id);
      beforeSummary[record.period_type].total_valor += parseFloat(record.value || 0);
    });
    
    const beforeSummaryFormatted: Record<string, any> = {};
    Object.entries(beforeSummary).forEach(([period, data]) => {
      beforeSummaryFormatted[period] = {
        registros: data.registros,
        modelos: data.modelos.size,
        total_valor: data.total_valor
      };
    });
    
    console.log('📊 Estado ANTES:', beforeSummaryFormatted);
    
    // 1. Verificar datos específicos del usuario
    console.log('\n📊 [CLEAN-HISTORY-AUTH] 1. Verificando datos del usuario:');
    const { data: userData, error: userError } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', user.id)
      .order('period_date', { ascending: false });
    
    if (userError) {
      console.error('❌ Error obteniendo datos del usuario:', userError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo datos del usuario'
      }, { status: 500 });
    }
    
    console.log(`✅ Registros del usuario: ${userData?.length || 0}`);
    
    let userSummary: Record<string, any> = {};
    if (userData && userData.length > 0) {
      userData.forEach(record => {
        const key = `${record.period_type}-${record.period_date}`;
        if (!userSummary[key]) {
          userSummary[key] = {
            period_type: record.period_type,
            period_date: record.period_date,
            registros: 0,
            plataformas: new Set(),
            total_valor: 0
          };
        }
        userSummary[key].registros++;
        userSummary[key].plataformas.add(record.platform_id);
        userSummary[key].total_valor += parseFloat(record.value || 0);
      });
      
      // Convertir Set a Array para JSON
      Object.values(userSummary).forEach((item: any) => {
        item.plataformas = Array.from(item.plataformas);
      });
    }
    
    // 2. Eliminar datos del período 2 (16-31) que no deberían existir
    console.log('\n📊 [CLEAN-HISTORY-AUTH] 2. Eliminando datos del período 2 (16-31):');
    const { data: period2Data, error: period2Error } = await supabase
      .from('calculator_history')
      .select('id')
      .eq('model_id', user.id)
      .eq('period_type', '16-31');
    
    let period2Deleted = 0;
    if (period2Error) {
      console.error('❌ Error obteniendo datos del período 2:', period2Error);
    } else {
      console.log(`✅ Registros del período 2 encontrados: ${period2Data?.length || 0}`);
      
      if (period2Data && period2Data.length > 0) {
        const ids = period2Data.map(record => record.id);
        
        const { error: deleteError } = await supabase
          .from('calculator_history')
          .delete()
          .in('id', ids);
        
        if (deleteError) {
          console.error('❌ Error eliminando período 2:', deleteError);
        } else {
          console.log(`✅ Período 2 eliminado: ${ids.length} registros`);
          period2Deleted = ids.length;
        }
      }
    }
    
    // 3. Verificar duplicados en el período 1
    console.log('\n📊 [CLEAN-HISTORY-AUTH] 3. Verificando duplicados en período 1:');
    const { data: period1Data, error: period1Error } = await supabase
      .from('calculator_history')
      .select('*')
      .eq('model_id', user.id)
      .eq('period_type', '1-15')
      .order('archived_at', { ascending: false });
    
    let duplicatesDeleted = 0;
    if (period1Error) {
      console.error('❌ Error obteniendo datos del período 1:', period1Error);
    } else {
      console.log(`✅ Registros del período 1: ${period1Data?.length || 0}`);
      
      if (period1Data && period1Data.length > 0) {
        // Identificar duplicados
        const duplicates: Record<string, any[]> = {};
        period1Data.forEach(record => {
          const key = `${record.platform_id}-${record.period_date}`;
          if (!duplicates[key]) {
            duplicates[key] = [];
          }
          duplicates[key].push(record);
        });
        
        const duplicateKeys = Object.keys(duplicates).filter(key => duplicates[key].length > 1);
        console.log(`✅ Registros con duplicados encontrados: ${duplicateKeys.length}`);
        
        if (duplicateKeys.length > 0) {
          // Eliminar duplicados (mantener solo el más reciente)
          for (const key of duplicateKeys) {
            const records = duplicates[key];
            const sortedRecords = records.sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at));
            const toDelete = sortedRecords.slice(1); // Mantener solo el primero (más reciente)
            
            const idsToDelete = toDelete.map(record => record.id);
            
            const { error: deleteError } = await supabase
              .from('calculator_history')
              .delete()
              .in('id', idsToDelete);
            
            if (deleteError) {
              console.error(`❌ Error eliminando duplicados para ${key}:`, deleteError);
            } else {
              console.log(`✅ Duplicados eliminados para ${key}: ${toDelete.length} registros`);
              duplicatesDeleted += toDelete.length;
            }
          }
        }
      }
    }
    
    // 4. Verificar estado DESPUÉS de la limpieza
    console.log('\n📊 [CLEAN-HISTORY-AUTH] 4. Verificando estado DESPUÉS de la limpieza:');
    const { data: afterData, error: afterError } = await supabase
      .from('calculator_history')
      .select('period_type, value, model_id');
    
    if (afterError) {
      console.error('❌ Error obteniendo datos después de limpieza:', afterError);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo datos después de limpieza'
      }, { status: 500 });
    }
    
    const afterSummary: Record<string, any> = {};
    afterData?.forEach(record => {
      if (!afterSummary[record.period_type]) {
        afterSummary[record.period_type] = {
          registros: 0,
          modelos: new Set(),
          total_valor: 0
        };
      }
      afterSummary[record.period_type].registros++;
      afterSummary[record.period_type].modelos.add(record.model_id);
      afterSummary[record.period_type].total_valor += parseFloat(record.value || 0);
    });
    
    const afterSummaryFormatted: Record<string, any> = {};
    Object.entries(afterSummary).forEach(([period, data]) => {
      afterSummaryFormatted[period] = {
        registros: data.registros,
        modelos: data.modelos.size,
        total_valor: data.total_valor
      };
    });
    
    console.log('📊 Estado DESPUÉS:', afterSummaryFormatted);
    
    console.log('\n✅ [CLEAN-HISTORY-AUTH] Limpieza completada');
    
    return NextResponse.json({
      success: true,
      message: 'Limpieza de historial completada',
      results: {
        user_id: user.id,
        before: beforeSummaryFormatted,
        after: afterSummaryFormatted,
        user_summary: userSummary,
        period2_deleted: period2Deleted,
        duplicates_deleted: duplicatesDeleted
      }
    });
    
  } catch (error) {
    console.error('❌ [CLEAN-HISTORY-AUTH] Error general:', error);
    return NextResponse.json({
      success: false,
      error: 'Error general en limpieza de historial'
    }, { status: 500 });
  }
}
