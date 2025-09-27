// =====================================================
// 📊 API DE AUDITORÍA
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth-modern';
import { getAuditLogs, getAuditStats, detectAnomalies } from '../../../lib/security/audit';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') {
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
