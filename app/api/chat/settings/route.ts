import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helper para validar el token y obtener el usuario
async function getAuthenticatedUser(request: NextRequest, supabase: any) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const user = await getAuthenticatedUser(request, supabase);
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('chat_user_settings')
      .select('theme')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      theme: data?.theme || 'default'
    });
    
  } catch (error: any) {
    console.error('Error fetching chat settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const user = await getAuthenticatedUser(request, supabase);
    if (!user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { theme } = await request.json();

    if (!theme) {
      return NextResponse.json({ success: false, error: 'Tema requerido' }, { status: 400 });
    }

    // Upsert the setting
    const { error } = await supabase
      .from('chat_user_settings')
      .upsert({
        user_id: user.id,
        theme: theme,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, theme });
    
  } catch (error: any) {
    console.error('Error updating chat settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

