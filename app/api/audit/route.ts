// =====================================================
// 📊 API SIMPLE DE AUDITORÍA
// =====================================================
// Endpoint simple para auditoría con autenticación directa
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuditLogs, getAuditStats, detectAnomalies } from '../../../lib/security/audit';

/**
 * 🔐 Autenticación simple y directa
 */
async function authenticateUser(request: NextRequest) {
  try {
    // Obtener token del Authorization header
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');
    
    if (!accessToken) {
      return { success: false, error: 'No autenticado' };
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verificar token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      return { success: false, error: 'Token inválido' };
    }

    // Obtener perfil del usuario
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Perfil no encontrado' };
    }

    if (!profile.is_active) {
      return { success: false, error: 'Usuario inactivo' };
    }

    return { success: true, user: profile };
  } catch (error) {
    console.error('❌ [AUTH] Error:', error);
    return { success: false, error: 'Error de autenticación' };
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [API] Obteniendo logs de auditoría');
    
    // Autenticación simple
    const authResult = await authenticateUser(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const currentUser = authResult.user;

    // Verificar permisos
    if (!['super_admin', 'admin'].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Sin permisos para ver auditoría' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const days = parseInt(url.searchParams.get('days') || '7');

    if (action === 'stats') {
      // Obtener estadísticas
      const stats = await getAuditStats(currentUser.organization_id, days);
      return NextResponse.json({
        success: true,
        stats
      });
    }

    if (action === 'anomalies') {
      // Detectar anomalías
      const anomalies = await detectAnomalies(currentUser.organization_id, 24);
      return NextResponse.json({
        success: true,
        anomalies
      });
    }

    // Obtener logs de auditoría
    const logs = await getAuditLogs({
      organizationId: currentUser.organization_id,
      limit: 1000
    });

    return NextResponse.json({
      success: true,
      logs
    });

  } catch (error) {
    console.error('❌ [AUDIT API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}