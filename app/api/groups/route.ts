// =====================================================
// 🏢 API ULTRA SIMPLE DE GRUPOS - VERSIÓN MÍNIMA
// =====================================================
// Solo operaciones básicas sin complejidades
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// 📋 GET - Obtener grupos (VERSIÓN MÍNIMA)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    console.log('🏢 [API] Obteniendo grupos (VERSIÓN MÍNIMA)');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, description')
      .order('name', { ascending: true });

    if (error) {
      console.error('❌ [API] Error:', error);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo grupos' },
        { status: 500 }
      );
    }

    console.log('✅ [API] Grupos obtenidos:', groups?.length || 0);

    return NextResponse.json({
      success: true,
      groups: groups || []
    });

  } catch (error) {
    console.error('❌ [API] Error general:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    );
  }
}