import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Limpiando portafolios creados incorrectamente...');
    
    // 1. Obtener los portafolios que se crearon con la sincronización incorrecta
    const { data: incorrectPortfolios, error: selectError } = await supabase
      .from('modelo_plataformas')
      .select(`
        id,
        model_id,
        platform_id,
        status,
        notes
      `)
      .eq('notes', 'Sincronización automática de configuración existente');

    if (selectError) {
      console.error('Error obteniendo portafolios incorrectos:', selectError);
      return NextResponse.json({ success: false, error: selectError.message }, { status: 500 });
    }

    if (!incorrectPortfolios || incorrectPortfolios.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No se encontraron portafolios creados por sincronización incorrecta',
        deleted: 0
      });
    }

    console.log(`📋 Portafolios encontrados para eliminar: ${incorrectPortfolios.length}`);

    // 2. Obtener emails de los usuarios
    const modelIds = Array.from(new Set(incorrectPortfolios.map(p => p.model_id)));
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .in('id', modelIds);

    if (usersError) {
      console.error('Error obteniendo usuarios:', usersError);
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 });
    }

    // 3. Crear mapa de ID a email
    const userIdToEmail = users?.reduce((acc, user) => {
      acc[user.id] = user.email;
      return acc;
    }, {} as Record<string, string>) || {};

    // 4. Agrupar por modelo para mostrar información
    const portfoliosByModel = incorrectPortfolios.reduce((acc, portfolio) => {
      const email = userIdToEmail[portfolio.model_id];
      if (!email) return acc;
      if (!acc[email]) {
        acc[email] = [];
      }
      acc[email].push(portfolio);
      return acc;
    }, {} as Record<string, any[]>);

    // 5. Eliminar todos los portafolios incorrectos
    const { error: deleteError } = await supabase
      .from('modelo_plataformas')
      .delete()
      .eq('notes', 'Sincronización automática de configuración existente');

    if (deleteError) {
      console.error('Error eliminando portafolios incorrectos:', deleteError);
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    // 4. Preparar resultado detallado
    const results = Object.entries(portfoliosByModel).map(([email, portfolios]) => ({
      email,
      platforms_deleted: portfolios.length
    }));

    console.log('✅ Portafolios incorrectos eliminados exitosamente');

    return NextResponse.json({ 
      success: true, 
      message: `Limpieza completada. ${incorrectPortfolios.length} portafolios eliminados`,
      deleted: incorrectPortfolios.length,
      results
    });
    
  } catch (error: any) {
    console.error('❌ Error en limpieza:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
