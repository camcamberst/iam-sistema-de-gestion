import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Limpiando completamente los datos de las modelos (excluyendo un ID específico)...');
    
    // ID de la modelo a EXCLUIR de la limpieza
    const excludedModelId = 'fe54995d-1828-4721-8153-53fce6f4fe56';

    // 1. Obtener todas las modelos con rol 'modelo', excluyendo el ID especificado
    const { data: targetUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .eq('role', 'modelo')
      .neq('id', excludedModelId); // Excluir este ID

    if (usersError) {
      console.error('Error obteniendo usuarios objetivo:', usersError);
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    if (!targetUsers || targetUsers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hay modelos para limpiar (o solo la modelo excluida).',
        cleaned: 0
      });
    }

    const userIds = targetUsers.map(u => u.id);
    console.log(`📋 Modelos encontradas para limpieza completa: ${targetUsers.length}`);

    // 2. Eliminar portafolios (modelo_plataformas)
    const { error: portfolioError } = await supabase
      .from('modelo_plataformas')
      .delete()
      .in('model_id', userIds);

    if (portfolioError) {
      console.error('Error eliminando portafolios:', portfolioError);
      return NextResponse.json({ success: false, error: portfolioError.message }, { status: 500 });
    }

    // 3. Eliminar configuraciones de calculadora
    const { error: configError } = await supabase
      .from('calculator_config')
      .delete()
      .in('model_id', userIds);

    if (configError) {
      console.error('Error eliminando configuraciones de calculadora:', configError);
      return NextResponse.json({ success: false, error: configError.message }, { status: 500 });
    }

    // 4. Preparar resultado detallado
    const results = targetUsers.map(user => ({
      email: user.email,
      user_id: user.id,
      status: 'Limpieza completa realizada'
    }));

    console.log('✅ Limpieza completa realizada exitosamente');

    return NextResponse.json({ 
      success: true, 
      message: `Limpieza completa realizada. ${targetUsers.length} modelos preparadas para configuración inicial`,
      cleaned: targetUsers.length,
      results
    });
    
  } catch (error: any) {
    console.error('❌ Error en limpieza completa:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
