import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (!groupId) {
      return NextResponse.json({
        success: false,
        error: 'Group ID is required'
      }, { status: 400 });
    }

    // Obtener rooms del grupo
    const { data: rooms, error } = await supabase
      .from('group_rooms')
      .select('id, room_name, is_active')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('room_name');

    if (error) {
      console.error('Error fetching rooms:', error);
      return NextResponse.json({
        success: false,
        error: 'Error fetching rooms'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rooms: rooms || []
    });

  } catch (error) {
    console.error('Error in rooms API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
