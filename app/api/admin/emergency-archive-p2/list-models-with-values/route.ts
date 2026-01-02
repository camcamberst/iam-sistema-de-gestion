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

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAdmin(request);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'p2-december'; // p2-december, all, current

    console.log('🔍 [LIST-MODELS] Listando modelos con valores, período:', period);

    let startDate: string;
    let endDate: string;
    let periodName: string;

    if (period === 'p2-december') {
      startDate = '2025-12-16';
      endDate = '2025-12-31';
      periodName = 'P2 de Diciembre 2025';
    } else if (period === 'all') {
      // Todos los períodos
      startDate = '2000-01-01';
      endDate = '2099-12-31';
      periodName = 'Todos los períodos';
    } else {
      // Período actual (basado en fecha de Colombia)
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      
      if (day <= 15) {
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month).padStart(2, '0')}-15`;
        periodName = `P1 de ${month}/${year}`;
      } else {
        startDate = `${year}-${String(month).padStart(2, '0')}-16`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        periodName = `P2 de ${month}/${year}`;
      }
    }

    // 1. Obtener todos los modelos con valores en el período
    const { data: valores, error: valoresError } = await supabase
      .from('model_values')
      .select('model_id, platform_id, value, period_date, updated_at')
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .order('model_id')
      .order('period_date', { ascending: false });

    if (valoresError) {
      console.error('❌ [LIST-MODELS] Error obteniendo valores:', valoresError);
      return NextResponse.json({
        success: false,
        error: valoresError.message
      }, { status: 500 });
    }

    // 2. Agrupar por modelo
    const modelosMap = new Map<string, {
      model_id: string;
      email: string;
      total_values: number;
      unique_platforms: number;
      periods: string[];
      values_by_period: Record<string, number>;
      latest_update: string;
    }>();

    valores?.forEach((v: any) => {
      if (!modelosMap.has(v.model_id)) {
        modelosMap.set(v.model_id, {
          model_id: v.model_id,
          email: '',
          total_values: 0,
          unique_platforms: 0,
          periods: [],
          values_by_period: {},
          latest_update: v.updated_at
        });
      }
      const modelo = modelosMap.get(v.model_id)!;
      modelo.total_values++;
      if (!modelo.periods.includes(v.period_date)) {
        modelo.periods.push(v.period_date);
      }
      if (!modelo.values_by_period[v.period_date]) {
        modelo.values_by_period[v.period_date] = 0;
      }
      modelo.values_by_period[v.period_date]++;
      if (new Date(v.updated_at) > new Date(modelo.latest_update)) {
        modelo.latest_update = v.updated_at;
      }
    });

    // 3. Obtener emails de los modelos
    const modelIds = Array.from(modelosMap.keys());
    if (modelIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', modelIds);

      users?.forEach((u: any) => {
        const modelo = modelosMap.get(u.id);
        if (modelo) {
          modelo.email = u.email;
        }
      });
    }

    // 4. Contar plataformas únicas por modelo
    modelosMap.forEach((modelo, modelId) => {
      const plataformasUnicas = new Set(
        valores?.filter((v: any) => v.model_id === modelId).map((v: any) => v.platform_id)
      );
      modelo.unique_platforms = plataformasUnicas.size;
    });

    const modelos = Array.from(modelosMap.values());

    // 5. Obtener totales en calculator_totals para estos modelos
    const { data: totals, error: totalsError } = await supabase
      .from('calculator_totals')
      .select('model_id, period_date, total_usd_bruto, total_usd_modelo, updated_at')
      .in('model_id', modelIds.length > 0 ? modelIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('period_date', startDate)
      .lte('period_date', endDate);

    // Agrupar totales por modelo
    const totalsByModel = new Map<string, any[]>();
    totals?.forEach((t: any) => {
      if (!totalsByModel.has(t.model_id)) {
        totalsByModel.set(t.model_id, []);
      }
      totalsByModel.get(t.model_id)!.push(t);
    });

    // Agregar información de totales a cada modelo
    modelos.forEach(modelo => {
      modelo.totals = totalsByModel.get(modelo.model_id) || [];
    });

    return NextResponse.json({
      success: true,
      period: periodName,
      date_range: { start: startDate, end: endDate },
      summary: {
        total_models: modelos.length,
        total_values: valores?.length || 0,
        models_with_totals: Array.from(totalsByModel.keys()).length
      },
      models: modelos.map(m => ({
        ...m,
        totals: m.totals || []
      }))
    });

  } catch (error: any) {
    console.error('❌ [LIST-MODELS] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}

