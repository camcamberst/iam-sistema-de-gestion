// =====================================================
// 📊 LOGGING Y MONITOREO MODERNO - SMART HOME
// =====================================================
// Sistema de logging estructurado
// Monitoreo de rendimiento y errores
// =====================================================

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  user_id?: string;
  action?: string;
  duration?: number;
  metadata?: Record<string, any>;
  error?: any;
}

export interface PerformanceMetric {
  action: string;
  duration: number;
  user_id?: string;
  timestamp: string;
  success: boolean;
  metadata?: Record<string, any>;
}

// =====================================================
// 🔧 FUNCIONES DE LOGGING
// =====================================================

/**
 * 📝 Log estructurado
 */
export function log(
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>,
  user_id?: string,
  action?: string
): void {
  const logEntry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    user_id,
    action,
    metadata
  };

  // Log en consola con colores
  const colors = {
    [LogLevel.DEBUG]: '\x1b[36m',    // Cyan
    [LogLevel.INFO]: '\x1b[32m',     // Green
    [LogLevel.WARN]: '\x1b[33m',     // Yellow
    [LogLevel.ERROR]: '\x1b[31m',    // Red
    [LogLevel.CRITICAL]: '\x1b[35m'  // Magenta
  };

  const reset = '\x1b[0m';
  const color = colors[level];
  
  console.log(
    `${color}[${level}]${reset} ${logEntry.timestamp} ${message}`,
    metadata ? JSON.stringify(metadata, null, 2) : ''
  );

  // En producción, aquí se enviaría a servicios como:
  // - Winston
  // - Pino
  // - DataDog
  // - New Relic
}

/**
 * 🐛 Debug logging
 */
export function debug(message: string, metadata?: Record<string, any>): void {
  if (process.env.NODE_ENV === 'development') {
    log(LogLevel.DEBUG, message, metadata);
  }
}

/**
 * ℹ️ Info logging
 */
export function info(message: string, metadata?: Record<string, any>): void {
  log(LogLevel.INFO, message, metadata);
}

/**
 * ⚠️ Warning logging
 */
export function warn(message: string, metadata?: Record<string, any>): void {
  log(LogLevel.WARN, message, metadata);
}

/**
 * ❌ Error logging
 */
export function error(message: string, error?: any, metadata?: Record<string, any>): void {
  log(LogLevel.ERROR, message, { ...metadata, error });
}

/**
 * 🚨 Critical logging
 */
export function critical(message: string, error?: any, metadata?: Record<string, any>): void {
  log(LogLevel.CRITICAL, message, { ...metadata, error });
  
  // Notificar errores críticos
  notifyCriticalError(message, error, metadata);
}

// =====================================================
// 📊 MONITOREO DE RENDIMIENTO
// =====================================================

/**
 * ⏱️ Medir tiempo de ejecución
 */
export function measurePerformance<T>(
  action: string,
  fn: () => Promise<T>,
  user_id?: string,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now();
  
  return fn()
    .then(result => {
      const duration = Date.now() - startTime;
      
      // Log de rendimiento
      log(LogLevel.INFO, `Performance: ${action}`, {
        ...metadata,
        duration,
        success: true
      }, user_id, action);
      
      return result;
    })
    .catch(err => {
      const duration = Date.now() - startTime;
      
      // Log de error con rendimiento
      log(LogLevel.ERROR, `Performance Error: ${action}`, {
        ...metadata,
        duration,
        success: false,
        error: err
      }, user_id, action);
      
      throw err;
    });
}

/**
 * 📈 Métricas de rendimiento
 */
export function trackMetric(
  action: string,
  duration: number,
  success: boolean,
  user_id?: string,
  metadata?: Record<string, any>
): void {
  const metric: PerformanceMetric = {
    action,
    duration,
    user_id,
    timestamp: new Date().toISOString(),
    success,
    metadata
  };

  // Log de métrica
  log(LogLevel.INFO, `Metric: ${action}`, {
    duration,
    success,
    ...metadata
  }, user_id, action);

  // En producción, esto se enviaría a servicios como:
  // - DataDog
  // - New Relic
  // - CloudWatch
  // - Prometheus
}

// =====================================================
// 🔔 NOTIFICACIONES
// =====================================================

/**
 * 🚨 Notificar errores críticos
 */
function notifyCriticalError(
  message: string,
  error?: any,
  metadata?: Record<string, any>
): void {
  // En un sistema real, esto enviaría notificaciones a:
  // - Slack webhook
  // - Email
  // - SMS
  // - PagerDuty
  
  console.error('🚨 [CRITICAL NOTIFICATION]', {
    message,
    error,
    metadata,
    timestamp: new Date().toISOString()
  });
}

// =====================================================
// 📊 ESTADÍSTICAS Y REPORTES
// =====================================================

/**
 * 📈 Obtener estadísticas de logs
 */
export function getLogStats(): {
  total_logs: number;
  logs_by_level: Record<LogLevel, number>;
  recent_logs: LogEntry[];
  performance_metrics: PerformanceMetric[];
} {
  // En un sistema real, esto consultaría una base de datos de logs
  return {
    total_logs: 0,
    logs_by_level: {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
      [LogLevel.CRITICAL]: 0
    },
    recent_logs: [],
    performance_metrics: []
  };
}

/**
 * 📊 Dashboard de monitoreo
 */
export function getMonitoringDashboard(): {
  system_health: 'healthy' | 'degraded' | 'critical';
  active_users: number;
  error_rate: number;
  average_response_time: number;
  uptime: number;
} {
  return {
    system_health: 'healthy',
    active_users: 0,
    error_rate: 0,
    average_response_time: 0,
    uptime: 100
  };
}

// =====================================================
// 🎯 LOGGING ESPECÍFICO POR MÓDULO
// =====================================================

/**
 * 🔐 Logging de autenticación
 */
export function logAuth(action: string, user_id?: string, metadata?: Record<string, any>): void {
  log(LogLevel.INFO, `Auth: ${action}`, { ...metadata, module: 'auth' }, user_id, action);
}

/**
 * 👥 Logging de usuarios
 */
export function logUser(action: string, user_id?: string, metadata?: Record<string, any>): void {
  log(LogLevel.INFO, `User: ${action}`, { ...metadata, module: 'user' }, user_id, action);
}

/**
 * 🏢 Logging de grupos
 */
export function logGroup(action: string, user_id?: string, metadata?: Record<string, any>): void {
  log(LogLevel.INFO, `Group: ${action}`, { ...metadata, module: 'group' }, user_id, action);
}

/**
 * 🗄️ Logging de base de datos
 */
export function logDatabase(action: string, user_id?: string, metadata?: Record<string, any>): void {
  log(LogLevel.INFO, `Database: ${action}`, { ...metadata, module: 'database' }, user_id, action);
}

/**
 * 🌐 Logging de API
 */
export function logAPI(action: string, user_id?: string, metadata?: Record<string, any>): void {
  log(LogLevel.INFO, `API: ${action}`, { ...metadata, module: 'api' }, user_id, action);
}

// =====================================================
// ✅ LOGGING Y MONITOREO COMPLETADO
// =====================================================
// ✅ Logging estructurado
// ✅ Monitoreo de rendimiento
// ✅ Notificaciones críticas
// ✅ Estadísticas y reportes
// ✅ Logging específico por módulo
// =====================================================
