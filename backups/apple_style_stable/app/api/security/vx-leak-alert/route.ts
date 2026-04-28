import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getAdminsAndSuperAdmins(modelId: string): Promise<string[]> {
  // Grupos de la modelo
  const { data: modelGroups } = await supabase
    .from('user_groups')
    .select('group_id')
    .eq('user_id', modelId);

  const groupIds = modelGroups?.map((g: { group_id: string }) => g.group_id) ?? [];
  let adminIds: string[] = [];

  if (groupIds.length > 0) {
    const { data: groupMembers } = await supabase
      .from('user_groups')
      .select('user_id')
      .in('group_id', groupIds);

    const memberIds = groupMembers?.map((m: { user_id: string }) => m.user_id) ?? [];

    if (memberIds.length > 0) {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .in('id', memberIds)
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true);

      adminIds = admins?.map((a: { id: string }) => a.id) ?? [];
    }
  }

  // Todos los super_admins siempre incluidos
  const { data: superAdmins } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'super_admin')
    .eq('is_active', true);

  const superAdminIds = superAdmins?.map((sa: { id: string }) => sa.id) ?? [];

  return Array.from(new Set([...adminIds, ...superAdminIds]));
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { code } = await request.json() as { code: string };

    if (!code) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
    }

    // Datos de la modelo
    const { data: modelData } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const modelName = modelData?.name || modelData?.email?.split('@')[0] || 'Modelo desconocida';

    // Obtener destinatarios
    const recipientIds = await getAdminsAndSuperAdmins(user.id);

    if (recipientIds.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const message =
      `🚨 **Alerta de seguridad — Posible filtración de información sensible**\n\n` +
      `La modelo **${modelName}** intentó dictar el código **${code}** usando el Lector de Código Vx. ` +
      `Los primeros 3 dígitos coinciden con numeración de telefonía móvil colombiana, ` +
      `lo que podría indicar una filtración de datos personales de usuario.\n\n` +
      `Por favor, verifica la situación con la modelo a la brevedad.`;

    await Promise.all(
      recipientIds.map(adminId =>
        sendBotNotification(adminId, 'error_critico', message)
      )
    );

    return NextResponse.json({ sent: recipientIds.length });
  } catch (err) {
    console.error('[vx-leak-alert] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
