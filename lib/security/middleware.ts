// =====================================================
// 🔒 MIDDLEWARE DE SEGURIDAD
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHeaders } from './protection';
import { createAuditLog } from './audit';
import { hasPermission, type Role } from './permissions';

export async function securityMiddleware(
  request: NextRequest,
  requiredPermission: string,
  userRole: Role,
  userId: string,
  organizationId: string
) {
  // Verificar permisos
  if (!hasPermission(userRole, requiredPermission as any)) {
    await createAuditLog({
      user_id: userId,
      action: 'permission.denied',
      severity: 'high',
      description: `Acceso denegado a ${requiredPermission}`,
      organization_id: organizationId,
      success: false,
      error_message: 'Insufficient permissions'
    });
    
    return NextResponse.json(
      { success: false, error: 'Acceso denegado' },
      { status: 403 }
    );
  }

  // Agregar headers de seguridad
  const response = NextResponse.next();
  const headers = getSecurityHeaders();
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
