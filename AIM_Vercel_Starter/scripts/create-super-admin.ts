import { supabaseAdmin, APP_USERS_TABLE, USER_GROUPS_TABLE, GROUPS_TABLE } from "../lib/supabaseAdmin";

interface CreateSuperAdminParams {
  email: string;
  name: string;
  password: string;
}

async function createSuperAdmin({ email, name, password }: CreateSuperAdminParams) {
  console.log("👑 Creando super administrador...");
  
  try {
    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automáticamente
      user_metadata: { name }
    });
    
    if (authError) {
      console.error("❌ Error creando usuario en Auth:", authError);
      return { success: false, error: authError.message };
    }
    
    const userId = authData.user.id;
    console.log("✅ Usuario creado en Auth:", userId);
    
    // 2. Crear perfil en app_users
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from(APP_USERS_TABLE)
      .insert({
        id: userId, // Usar el mismo ID de auth.users
        email,
        name,
        role: "super_admin",
        is_active: true
      })
      .select()
      .single();
    
    if (profileError) {
      console.error("❌ Error creando perfil:", profileError);
      return { success: false, error: profileError.message };
    }
    
    console.log("✅ Perfil creado:", profileData.id);
    
    // 3. Asignar todos los grupos (super_admin tiene acceso a todo)
    const { data: allGroups, error: groupsError } = await supabaseAdmin
      .from(GROUPS_TABLE)
      .select("id");
    
    if (groupsError) {
      console.error("❌ Error obteniendo grupos:", groupsError);
      return { success: false, error: groupsError.message };
    }
    
    if (allGroups && allGroups.length > 0) {
      const userGroups = allGroups.map(group => ({
        user_id: userId,
        group_id: group.id
      }));
      
      const { error: linkError } = await supabaseAdmin
        .from(USER_GROUPS_TABLE)
        .insert(userGroups);
      
      if (linkError) {
        console.error("❌ Error asignando grupos:", linkError);
        return { success: false, error: linkError.message };
      }
      
      console.log(`✅ Asignados ${allGroups.length} grupos al super_admin`);
    }
    
    console.log("🎉 Super administrador creado exitosamente");
    return { 
      success: true, 
      user: { 
        id: userId, 
        email, 
        name, 
        role: "super_admin",
        groups: allGroups?.length || 0
      } 
    };
    
  } catch (error: any) {
    console.error("❌ Error general:", error);
    return { success: false, error: error.message };
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Uso: ts-node create-super-admin.ts <email> <name> <password>");
    process.exit(1);
  }
  
  const [email, name, password] = args;
  createSuperAdmin({ email, name, password }).then(result => {
    console.log("Resultado:", result);
    process.exit(result.success ? 0 : 1);
  });
}

export { createSuperAdmin };





