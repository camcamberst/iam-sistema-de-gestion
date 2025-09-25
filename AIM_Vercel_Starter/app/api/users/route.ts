import { NextResponse } from "next/server";
import { getCurrentUser, hasRoleAtLeast } from "@/lib/auth";
import { DEFAULT_GROUPS, DEFAULT_ROLES } from "@/lib/constants";
import { supabaseAdmin, APP_USERS_TABLE, GROUPS_TABLE, USER_GROUPS_TABLE } from "@/lib/supabaseAdmin";

export async function GET() {
  const user = getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "admin")) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }
  // Obtener usuarios desde tabla app_users y sus grupos
  const { data: users, error } = await supabaseAdmin.from(APP_USERS_TABLE).select("id,email,name,role,is_active,created_at,last_login, user_groups: user_groups(group:groups(name))");
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const mapped = (users || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    groups: (u.user_groups || []).map((ug: any) => ug.group?.name).filter(Boolean),
    isActive: u.is_active,
    createdAt: u.created_at,
    lastLogin: u.last_login
  }));
  return NextResponse.json({ success: true, users: mapped, count: mapped.length });
}

export async function POST(req: Request) {
  try {
    const user = getCurrentUser();
    if (!user || !hasRoleAtLeast(user.role, "admin")) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }
    const body = await req.json();
    const { email, name, role, groups } = body || {};

    // Validaciones básicas
    if (!email || !name || !role) {
      return NextResponse.json({ success: false, error: "email, name y role son requeridos" }, { status: 400 });
    }
    if (!DEFAULT_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: "Rol inválido" }, { status: 400 });
    }
    if (groups && (!Array.isArray(groups) || groups.some((g: string) => !DEFAULT_GROUPS.includes(g)))) {
      return NextResponse.json({ success: false, error: "Grupo inválido" }, { status: 400 });
    }

    // Reglas por rol creador
    if (user.role === "admin") {
      // Admin solo puede crear modelos
      if (role !== "modelo") {
        return NextResponse.json({ success: false, error: "Admin solo puede crear modelos" }, { status: 403 });
      }
      // Grupos del nuevo modelo deben ser subconjunto de los del admin
      const creatorGroups = new Set(user.groups || []);
      const requestedGroups: string[] = Array.isArray(groups) ? groups : [];
      const invalid = requestedGroups.filter(g => !creatorGroups.has(g));
      if (invalid.length > 0) {
        return NextResponse.json({ success: false, error: "Grupo fuera de alcance del admin" }, { status: 403 });
      }
    }

    // super_admin puede crear cualquier rol y asignar cualquier grupo

    // Crear usuario en Auth (opcional: si aún no existe)
    // Nota: en proyectos reales, usa supabase-admin auth api (invite o create user)

    // Crear perfil en app_users
    const { data: created, error: errUser } = await supabaseAdmin.from(APP_USERS_TABLE).insert({ email, name, role, is_active: true }).select().single();
    if (errUser) return NextResponse.json({ success: false, error: errUser.message }, { status: 500 });

    const newUserId = created.id;
    const groupNames: string[] = Array.isArray(groups) ? groups : [];

    if (groupNames.length > 0) {
      // Obtener IDs de grupos por nombre
      const { data: groupRows, error: errGroups } = await supabaseAdmin.from(GROUPS_TABLE).select("id,name").in("name", groupNames);
      if (errGroups) return NextResponse.json({ success: false, error: errGroups.message }, { status: 500 });
      const groupIds = (groupRows || []).map((g: any) => g.id);
      if (groupIds.length !== groupNames.length) {
        return NextResponse.json({ success: false, error: "Grupo no encontrado en catálogo" }, { status: 400 });
      }
      // Insertar relaciones user_groups
      const payload = groupIds.map((gid: string) => ({ user_id: newUserId, group_id: gid }));
      const { error: errLink } = await supabaseAdmin.from(USER_GROUPS_TABLE).insert(payload);
      if (errLink) return NextResponse.json({ success: false, error: errLink.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: newUserId, email, name, role, groups: groupNames } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Error" }, { status: 500 });
  }
}


