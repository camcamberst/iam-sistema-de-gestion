import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '../../../types';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    console.log("🔍 API /api/users: Fetching users...");
    
    // Fetch users from the 'users' table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, role, created_at');

    if (usersError) {
      console.error("❌ API /api/users: Error fetching users:", usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    console.log("✅ API /api/users: Users fetched successfully:", users);

    // Fetch groups for each user separately
    const usersWithGroups = await Promise.all((users || []).map(async (user) => {
      const { data: userGroups, error: userGroupsError } = await supabase
        .from('user_groups')
        .select('groups(name)')
        .eq('user_id', user.id);

      if (userGroupsError) {
        console.error(`❌ API /api/users: Error fetching groups for user ${user.id}:`, userGroupsError);
        return { ...user, groups: [] };
      }

      const groups = userGroups
        .map(ug => (ug.groups && typeof ug.groups === 'object' && 'name' in ug.groups) ? ug.groups.name : null)
        .filter(Boolean);

      return { ...user, groups };
    }));

    console.log("✅ API /api/users: Users with groups:", usersWithGroups);
    return NextResponse.json(usersWithGroups, { status: 200 });

  } catch (error: any) {
    console.error("❌ API /api/users: General API Error:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { full_name, email, password, role, groups: groupIds } = await request.json();
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

  try {
    console.log("🔍 API /api/users POST: Creating user...", { full_name, email, role, groupIds });
    
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (authError) {
      console.error("❌ API /api/users POST: Supabase Auth Error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "User ID not returned after creation." }, { status: 500 });
    }

    console.log("✅ API /api/users POST: User created in Auth:", userId);

    // 2. Create user in public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        name: full_name,
        role: role
      })
      .select()
      .single();

    if (userError) {
      console.error("❌ API /api/users POST: Error creating user in public.users:", userError);
      // Optionally delete the user from auth if profile creation fails
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    console.log("✅ API /api/users POST: User created in public.users:", userData);

    // 3. Assign groups if not Super Admin
    if (role !== 'super_admin' && groupIds && groupIds.length > 0) {
      const userGroupInserts = groupIds.map((groupId: string) => ({
        user_id: userId,
        group_id: groupId,
        is_manager: role === 'admin', // Admins are managers of their groups
      }));

      const { error: userGroupError } = await supabase
        .from('user_groups')
        .insert(userGroupInserts);

      if (userGroupError) {
        console.error("❌ API /api/users POST: Supabase User Group Error:", userGroupError);
        // Optionally delete the user from auth if group assignment fails
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: userGroupError.message }, { status: 500 });
      }

      console.log("✅ API /api/users POST: Groups assigned successfully");
    }

    return NextResponse.json({ message: "Usuario creado exitosamente", userId }, { status: 201 });

  } catch (error: any) {
    console.error("❌ API /api/users POST: General API Error:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}


