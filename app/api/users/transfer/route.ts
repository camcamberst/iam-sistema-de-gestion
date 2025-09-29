// =====================================================
// 🔁 TRANSFER - Transferir usuario entre grupos (según jerarquía)
// =====================================================
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CurrentUser, User } from '../../../../lib/hierarchy';
import { canTransferUser } from '../../../../lib/hierarchy';

/**
 * Body esperado:
 * {
 *   current_user: { id: string, role: 'super_admin'|'admin'|'modelo', groups: {id,name}[] },
 *   target_user_id: string,
 *   to_group_id: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { current_user, target_user_id, to_group_id } = body || {};

    if (!current_user || !target_user_id || !to_group_id) {
      return NextResponse.json({ success: false, error: 'Parámetros incompletos' }, { status: 400 });
    }

    const currentUser: CurrentUser = {
      id: current_user.id,
      role: current_user.role,
      groups: current_user.groups || []
    };

    // Cargar usuario objetivo con sus grupos
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', target_user_id)
      .single();
    if (userErr || !userRow) {
      return NextResponse.json({ success: false, error: 'Usuario objetivo no encontrado' }, { status: 404 });
    }

    const { data: ugRows, error: ugErr } = await supabase
      .from('user_groups')
      .select('groups(id,name)')
      .eq('user_id', target_user_id);
    if (ugErr) {
      return NextResponse.json({ success: false, error: 'Error obteniendo grupos del usuario' }, { status: 500 });
    }

    const targetUser: User = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      is_active: userRow.is_active,
      groups: (ugRows || []).map((r: any) => ({ id: r.groups?.id, name: r.groups?.name })).filter((g: any) => g.id)
    };

    // Validar autorización por jerarquía
    if (!canTransferUser(currentUser, targetUser)) {
      return NextResponse.json({ success: false, error: 'No autorizado para transferir este usuario' }, { status: 403 });
    }

    // Validar grupo destino existe
    const { data: groupRow, error: groupErr } = await supabase
      .from('groups')
      .select('id, name')
      .eq('id', to_group_id)
      .single();
    if (groupErr || !groupRow) {
      return NextResponse.json({ success: false, error: 'Grupo destino no válido' }, { status: 400 });
    }

    // Reglas de negocio: modelos deben quedar con un solo grupo (destino)
    // Para otros roles, permitimos la misma operación si super_admin, pero por ahora
    // aplicamos la lógica de reemplazo de grupos igualmente para simplificar.

    // 1) Eliminar asignaciones actuales
    const { error: delErr } = await supabase
      .from('user_groups')
      .delete()
      .eq('user_id', target_user_id);
    if (delErr) {
      return NextResponse.json({ success: false, error: 'Error removiendo grupos actuales' }, { status: 500 });
    }

    // 2) Insertar asignación al grupo destino
    const { error: insErr } = await supabase
      .from('user_groups')
      .insert([{ user_id: target_user_id, group_id: to_group_id, is_manager: false }]);
    if (insErr) {
      return NextResponse.json({ success: false, error: 'Error asignando grupo destino' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario transferido correctamente',
      user_id: target_user_id,
      to_group_id,
      role: targetUser.role
    });
  } catch (e) {
    console.error('❌ [API] Transfer error:', e);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}


