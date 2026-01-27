import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * GET: Obtener todos los retiros (para admin)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const modelId = searchParams.get('modelId');

    // Verificar autenticación y rol
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que es admin
    const { data: userData } = await supabase
      .from('users')
      .select('role, affiliate_studio_id')
      .eq('id', user.id)
      .single();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    // Construir query
    let query = supabase
      .from('savings_withdrawals')
      .select(`
        *,
        model:users!savings_withdrawals_model_id_fkey(
          id, 
          name, 
          email,
          user_groups(
            group_id,
            groups(id, name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros
    if (estado) {
      const estados = estado.split(',');
      if (estados.length > 1) {
        query = query.in('estado', estados);
      } else {
        query = query.eq('estado', estado);
      }
    }

    if (modelId) {
      query = query.eq('model_id', modelId);
    }

    // Si es admin (no super_admin), filtrar por grupos
    if (userData.role === 'admin') {
      // Obtener grupos del admin
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = adminGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        // Obtener modelos de esos grupos
        const { data: groupModels } = await supabase
          .from('user_groups')
          .select('user_id')
          .in('group_id', groupIds)
          .eq('users.role', 'modelo');

        const modelIds = groupModels?.map((gm: any) => gm.user_id).filter((id): id is string => !!id) || [];
        
        if (modelIds.length > 0) {
          query = query.in('model_id', modelIds);
        } else {
          // Si no hay modelos en sus grupos, retornar vacío
          return NextResponse.json({ success: true, withdrawals: [] });
        }
      } else {
        // Si no tiene grupos, retornar vacío
        return NextResponse.json({ success: true, withdrawals: [] });
      }
    }

    const { data: withdrawals, error: withdrawalsError } = await query;

    if (withdrawalsError) {
      console.error('❌ [ADMIN-WITHDRAWALS] Error obteniendo retiros:', withdrawalsError);
      return NextResponse.json({ success: false, error: withdrawalsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      withdrawals: withdrawals || []
    });

  } catch (error: any) {
    console.error('❌ [ADMIN-WITHDRAWALS] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
