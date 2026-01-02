import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

async function authenticateAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'No autorizado', user: null };
  }

  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Token inválido', user: null };
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
    return { error: 'No tienes permisos de administrador', user: null };
  }

  return { error: null, user };
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { modelId, resetAll } = body;

    if (!modelId && !resetAll) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere modelId o resetAll=true'
      }, { status: 400 });
    }

    console.log('🔄 [RESET-CALCULATOR] Iniciando reset completo de calculadora(s)...');
    console.log(`📋 [RESET-CALCULATOR] ModelId: ${modelId || 'ALL'}, ResetAll: ${resetAll || false}`);

    let modelIds: string[] = [];
    
    if (resetAll) {
      // Obtener todos los modelos activos
      const { data: models, error: modelsError } = await supabase
        .from('users')
        .select('id, email')
        .eq('role', 'modelo')
        .eq('is_active', true);
      
      if (modelsError) {
        throw new Error(`Error obteniendo modelos: ${modelsError.message}`);
      }
      
      modelIds = models?.map(m => m.id) || [];
      console.log(`📋 [RESET-CALCULATOR] Resetear ${modelIds.length} modelos`);
    } else if (modelId) {
      modelIds = [modelId];
    }

    const resultados = [];
    let totalModelValuesDeleted = 0;
    let totalTotalsDeleted = 0;
    let exitosos = 0;
    let errores = 0;

    for (const id of modelIds) {
      const resultado: any = {
        model_id: id,
        email: '',
        model_values_deleted: 0,
        calculator_totals_deleted: 0,
        error: null
      };

      try {
        // Obtener email
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', id)
          .single();
        
        resultado.email = userData?.email || id;

        console.log(`🔄 [RESET-CALCULATOR] Reseteando calculadora de ${resultado.email}...`);

        // 1. Eliminar TODOS los valores de model_values (sin filtro de período)
        console.log(`   🗑️ [RESET-CALCULATOR] Eliminando valores de model_values...`);
        const { data: deletedValues, error: deleteValuesError } = await supabase
          .from('model_values')
          .delete()
          .eq('model_id', id)
          .select();

        if (deleteValuesError) {
          throw new Error(`Error eliminando model_values: ${deleteValuesError.message}`);
        }

        resultado.model_values_deleted = deletedValues?.length || 0;
        totalModelValuesDeleted += resultado.model_values_deleted;
        console.log(`   ✅ [RESET-CALCULATOR] ${resultado.model_values_deleted} valores eliminados de model_values`);

        // 2. Eliminar TODOS los totales de calculator_totals (sin filtro de período)
        console.log(`   🗑️ [RESET-CALCULATOR] Eliminando totales de calculator_totals...`);
        const { data: deletedTotals, error: deleteTotalsError } = await supabase
          .from('calculator_totals')
          .delete()
          .eq('model_id', id)
          .select();

        if (deleteTotalsError) {
          throw new Error(`Error eliminando calculator_totals: ${deleteTotalsError.message}`);
        }

        resultado.calculator_totals_deleted = deletedTotals?.length || 0;
        totalTotalsDeleted += resultado.calculator_totals_deleted;
        console.log(`   ✅ [RESET-CALCULATOR] ${resultado.calculator_totals_deleted} totales eliminados de calculator_totals`);

        exitosos++;
        console.log(`   ✅ [RESET-CALCULATOR] ${resultado.email}: Reset completo exitoso`);

      } catch (error: any) {
        resultado.error = error.message || 'Error desconocido';
        errores++;
        console.error(`   ❌ [RESET-CALCULATOR] Error reseteando ${resultado.email}:`, error);
      }

      resultados.push(resultado);
    }

    // Verificación final
    console.log('🔍 [RESET-CALCULATOR] Verificación final...');
    let finalModelValuesCount = 0;
    let finalTotalsCount = 0;

    if (resetAll) {
      const { count: mvCount } = await supabase
        .from('model_values')
        .select('*', { count: 'exact', head: true })
        .in('model_id', modelIds);
      
      const { count: totalsCount } = await supabase
        .from('calculator_totals')
        .select('*', { count: 'exact', head: true })
        .in('model_id', modelIds);
      
      finalModelValuesCount = mvCount || 0;
      finalTotalsCount = totalsCount || 0;
    } else if (modelId) {
      const { count: mvCount } = await supabase
        .from('model_values')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId);
      
      const { count: totalsCount } = await supabase
        .from('calculator_totals')
        .select('*', { count: 'exact', head: true })
        .eq('model_id', modelId);
      
      finalModelValuesCount = mvCount || 0;
      finalTotalsCount = totalsCount || 0;
    }

    console.log(`✅ [RESET-CALCULATOR] Proceso completado: ${exitosos} exitosos, ${errores} errores`);
    console.log(`📊 [RESET-CALCULATOR] Total valores eliminados: ${totalModelValuesDeleted}, Total totales eliminados: ${totalTotalsDeleted}`);
    console.log(`🔍 [RESET-CALCULATOR] Valores residuales: ${finalModelValuesCount}, Totales residuales: ${finalTotalsCount}`);

    return NextResponse.json({
      success: true,
      mensaje: `Reset completo realizado. ${totalModelValuesDeleted} valores y ${totalTotalsDeleted} totales eliminados de ${exitosos} modelo(s).`,
      resumen: {
        total_modelos: resultados.length,
        exitosos,
        errores,
        total_model_values_deleted: totalModelValuesDeleted,
        total_calculator_totals_deleted: totalTotalsDeleted,
        residuales_model_values: finalModelValuesCount,
        residuales_calculator_totals: finalTotalsCount
      },
      resultados: resultados
    });

  } catch (error: any) {
    console.error('❌ [RESET-CALCULATOR] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

