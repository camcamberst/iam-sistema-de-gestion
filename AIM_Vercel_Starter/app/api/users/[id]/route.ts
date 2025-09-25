import { NextResponse } from "next/server";
import { getCurrentUser, hasRoleAtLeast } from "@/lib/auth";
import { supabaseAdmin, APP_USERS_TABLE, USER_GROUPS_TABLE, GROUPS_TABLE } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "admin")) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { name, role, groups, isActive } = body || {};

  // Admin no puede elevar roles; solo super_admin puede cambiar role
  if (role && user.role !== "super_admin") {
    return NextResponse.json({ success: false, error: "Solo super_admin puede cambiar roles" }, { status: 403 });
  }

  // Actualizar campos básicos
  const updatePayload: any = {};
  if (name) updatePayload.name = name;
  if (typeof isActive === "boolean") updatePayload.is_active = isActive;
  if (role) updatePayload.role = role;

  if (Object.keys(updatePayload).length > 0) {
    const { error: errUpd } = await supabaseAdmin.from(APP_USERS_TABLE).update(updatePayload).eq("id", params.id);
    if (errUpd) return NextResponse.json({ success: false, error: errUpd.message }, { status: 500 });
  }

  // Actualizar grupos (reemplazo completo)
  if (Array.isArray(groups)) {
    // Para admin: los grupos asignados al modelo deben ser subset de sus propios grupos
    if (user.role === "admin") {
      const creatorGroups = new Set(user.groups || []);
      const invalid = groups.filter((g: string) => !creatorGroups.has(g));
      if (invalid.length) {
        return NextResponse.json({ success: false, error: "Grupo fuera de alcance del admin" }, { status: 403 });
      }
    }

    // Borrar relaciones actuales
    const { error: errDel } = await supabaseAdmin.from(USER_GROUPS_TABLE).delete().eq("user_id", params.id);
    if (errDel) return NextResponse.json({ success: false, error: errDel.message }, { status: 500 });

    if (groups.length > 0) {
      // Obtener IDs por nombre
      const { data: groupRows, error: errGroups } = await supabaseAdmin.from(GROUPS_TABLE).select("id,name").in("name", groups);
      if (errGroups) return NextResponse.json({ success: false, error: errGroups.message }, { status: 500 });
      const groupIds = (groupRows || []).map((g: any) => g.id);
      if (groupIds.length !== groups.length) {
        return NextResponse.json({ success: false, error: "Grupo no encontrado en catálogo" }, { status: 400 });
      }
      const payload = groupIds.map((gid: string) => ({ user_id: params.id, group_id: gid }));
      const { error: errIns } = await supabaseAdmin.from(USER_GROUPS_TABLE).insert(payload);
      if (errIns) return NextResponse.json({ success: false, error: errIns.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, id: params.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "admin")) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  // Borrar relaciones y usuario
  const { error: errRel } = await supabaseAdmin.from(USER_GROUPS_TABLE).delete().eq("user_id", params.id);
  if (errRel) return NextResponse.json({ success: false, error: errRel.message }, { status: 500 });
  const { error: errUser } = await supabaseAdmin.from(APP_USERS_TABLE).delete().eq("id", params.id);
  if (errUser) return NextResponse.json({ success: false, error: errUser.message }, { status: 500 });
  return NextResponse.json({ success: true, id: params.id });
}


