// =====================================================
// 📊 SISTEMA DE AUDITORÍA AVANZADO - SMART HOME
// =====================================================
// Sistema completo de auditoría y logging de seguridad
// =====================================================

import { supabase } from '../supabase';

export type AuditAction = 
  // Autenticación
  | 'auth.login'
  | 'auth.logout'
  | 'auth.login_failed'
  | 'auth.password_change'
  | 'auth.password_reset'
  
  // Usuarios
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.activate'
  | 'user.deactivate'
  | 'user.role_change'
  
  // Grupos
  | 'group.create'
  | 'group.update'
  | 'group.delete'
  | 'group.assign_user'
  | 'group.remove_user'
  
  // Permisos
  | 'permission.grant'
  | 'permission.revoke'
  | 'permission.denied'
  
  // Sistema
  | 'system.settings_change'
  | 'system.backup'
  | 'system.restore'
  | 'system.error'
  
  // Datos
  | 'data.export'
  | 'data.import'
  | 'data.delete'
  
  // API
  | 'api.request'
  | 'api.response'
  | 'api.error';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLog {
  id?: string;
  user_id: string;
  action: AuditAction;
  severity: AuditSeverity;
  description: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  organization_id: string;
  timestamp: Date;
  success: boolean;
  error_message?: string;
}

export interface AuditFilter {
  userId?: string;
  action?: AuditAction;
  severity?: AuditSeverity;
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

// =====================================================
// 📝 FUNCIONES DE AUDITORÍA
// =====================================================

export async function createAuditLog(auditData: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: auditData.user_id,
        action: auditData.action,
        severity: auditData.severity,
        description: auditData.description,
        metadata: auditData.metadata || {},
        ip_address: auditData.ip_address,
        user_agent: auditData.user_agent,
        organization_id: auditData.organization_id,
        success: auditData.success,
        error_message: auditData.error_message,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('❌ [AUDIT] Error creando log de auditoría:', error);
    } else {
      console.log('✅ [AUDIT] Log de auditoría creado:', auditData.action);
    }
  } catch (error) {
    console.error('❌ [AUDIT] Error general:', error);
  }
}

export async function getAuditLogs(filter: AuditFilter = {}): Promise<AuditLog[]> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    // Aplicar filtros
    if (filter.userId) {
      query = query.eq('user_id', filter.userId);
    }
    
    if (filter.action) {
      query = query.eq('action', filter.action);
    }
    
    if (filter.severity) {
      query = query.eq('severity', filter.severity);
    }
    
    if (filter.organizationId) {
      query = query.eq('organization_id', filter.organizationId);
    }
    
    if (filter.startDate) {
      query = query.gte('timestamp', filter.startDate.toISOString());
    }
    
    if (filter.endDate) {
      query = query.lte('timestamp', filter.endDate.toISOString());
    }
    
    if (filter.success !== undefined) {
      query = query.eq('success', filter.success);
    }
    
    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    
    if (filter.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ [AUDIT] Error obteniendo logs:', error);
      return [];
    }

    return (data || []).map(log => ({
      ...log,
      timestamp: new Date(log.timestamp)
    }));
  } catch (error) {
    console.error('❌ [AUDIT] Error general:', error);
    return [];
  }
}

// =====================================================
// 🔍 FUNCIONES DE ANÁLISIS DE AUDITORÍA
// =====================================================

export async function getAuditStats(organizationId: string, days: number = 30): Promise<{
  totalLogs: number;
  successRate: number;
  criticalIssues: number;
  topActions: Array<{ action: AuditAction; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  securityEvents: number;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await getAuditLogs({
      organizationId,
      startDate,
      limit: 10000
    });

    const totalLogs = logs.length;
    const successfulLogs = logs.filter(log => log.success).length;
    const successRate = totalLogs > 0 ? (successfulLogs / totalLogs) * 100 : 0;
    
    const criticalIssues = logs.filter(log => 
      log.severity === 'critical' && !log.success
    ).length;

    // Top acciones
    const actionCounts: Record<AuditAction, number> = {} as Record<AuditAction, number>;
    logs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    
    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action: action as AuditAction, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top usuarios
    const userCounts: Record<string, number> = {};
    logs.forEach(log => {
      userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;
    });
    
    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Eventos de seguridad
    const securityEvents = logs.filter(log => 
      log.action.includes('auth.') || 
      log.action.includes('permission.') ||
      log.severity === 'high' || 
      log.severity === 'critical'
    ).length;

    return {
      totalLogs,
      successRate: Math.round(successRate * 100) / 100,
      criticalIssues,
      topActions,
      topUsers,
      securityEvents
    };
  } catch (error) {
    console.error('❌ [AUDIT] Error obteniendo estadísticas:', error);
    return {
      totalLogs: 0,
      successRate: 0,
      criticalIssues: 0,
      topActions: [],
      topUsers: [],
      securityEvents: 0
    };
  }
}

// =====================================================
// 🚨 DETECCIÓN DE ANOMALÍAS
// =====================================================

export async function detectAnomalies(organizationId: string, hours: number = 24): Promise<{
  suspiciousLogins: number;
  failedAttempts: number;
  unusualActivity: number;
  criticalAlerts: number;
}> {
  try {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const logs = await getAuditLogs({
      organizationId,
      startDate,
      limit: 10000
    });

    // Intentos de login fallidos
    const failedLogins = logs.filter(log => 
      log.action === 'auth.login_failed'
    ).length;

    // Logins sospechosos (múltiples IPs, horarios inusuales)
    const loginLogs = logs.filter(log => log.action === 'auth.login');
    const ipCounts: Record<string, number> = {};
    loginLogs.forEach(log => {
      if (log.ip_address) {
        ipCounts[log.ip_address] = (ipCounts[log.ip_address] || 0) + 1;
      }
    });
    
    const suspiciousLogins = Object.values(ipCounts).filter(count => count > 5).length;

    // Actividad inusual (muchas acciones en poco tiempo)
    const userActionCounts: Record<string, number> = {};
    logs.forEach(log => {
      userActionCounts[log.user_id] = (userActionCounts[log.user_id] || 0) + 1;
    });
    
    const unusualActivity = Object.values(userActionCounts).filter(count => count > 50).length;

    // Alertas críticas
    const criticalAlerts = logs.filter(log => 
      log.severity === 'critical' && !log.success
    ).length;

    return {
      suspiciousLogins,
      failedAttempts: failedLogins,
      unusualActivity,
      criticalAlerts
    };
  } catch (error) {
    console.error('❌ [AUDIT] Error detectando anomalías:', error);
    return {
      suspiciousLogins: 0,
      failedAttempts: 0,
      unusualActivity: 0,
      criticalAlerts: 0
    };
  }
}

// =====================================================
// 📊 FUNCIONES DE REPORTE
// =====================================================

export async function generateSecurityReport(organizationId: string, days: number = 30): Promise<{
  summary: string;
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}> {
  try {
    const stats = await getAuditStats(organizationId, days);
    const anomalies = await detectAnomalies(organizationId, 24);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const recommendations: string[] = [];

    // Evaluar nivel de riesgo
    if (anomalies.criticalAlerts > 0) {
      riskLevel = 'critical';
    } else if (anomalies.suspiciousLogins > 0 || anomalies.failedAttempts > 10) {
      riskLevel = 'high';
    } else if (stats.successRate < 90 || anomalies.unusualActivity > 0) {
      riskLevel = 'medium';
    }

    // Generar recomendaciones
    if (anomalies.failedAttempts > 5) {
      recommendations.push('Implementar bloqueo temporal después de intentos fallidos');
    }
    
    if (anomalies.suspiciousLogins > 0) {
      recommendations.push('Revisar logs de autenticación por actividad sospechosa');
    }
    
    if (stats.successRate < 95) {
      recommendations.push('Investigar errores frecuentes en el sistema');
    }
    
    if (anomalies.criticalAlerts > 0) {
      recommendations.push('Revisar inmediatamente alertas críticas');
    }

    const summary = `
      Período: ${days} días
      Total de eventos: ${stats.totalLogs}
      Tasa de éxito: ${stats.successRate}%
      Eventos críticos: ${anomalies.criticalAlerts}
      Intentos fallidos: ${anomalies.failedAttempts}
      Nivel de riesgo: ${riskLevel.toUpperCase()}
    `;

    return {
      summary,
      recommendations,
      riskLevel
    };
  } catch (error) {
    console.error('❌ [AUDIT] Error generando reporte:', error);
    return {
      summary: 'Error generando reporte de seguridad',
      recommendations: ['Revisar configuración de auditoría'],
      riskLevel: 'high'
    };
  }
}

// =====================================================
// 🔧 UTILIDADES DE AUDITORÍA
// =====================================================

export function createAuditContext(request: Request): Partial<AuditLog> {
  const ipAddress = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return {
    ip_address: ipAddress,
    user_agent: userAgent
  };
}

export function getSeverityFromAction(action: AuditAction): AuditSeverity {
  if (action.includes('delete') || action.includes('critical')) {
    return 'critical';
  }
  
  if (action.includes('auth.') || action.includes('permission.')) {
    return 'high';
  }
  
  if (action.includes('update') || action.includes('change')) {
    return 'medium';
  }
  
  return 'low';
}
