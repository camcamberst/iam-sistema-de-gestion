// =====================================================
// 🛡️ MANEJO DE ERRORES ROBUSTO - SMART HOME
// =====================================================
// Sistema moderno de manejo de errores
// Logging y monitoreo integrado
// =====================================================

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  user_id?: string;
  action?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

// =====================================================
// 🚨 TIPOS DE ERRORES DEL SISTEMA
// =====================================================

export enum ErrorCodes {
  // Autenticación
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  
  // Base de datos
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',
  
  // API
  API_VALIDATION_ERROR = 'API_VALIDATION_ERROR',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  API_SERVICE_UNAVAILABLE = 'API_SERVICE_UNAVAILABLE',
  
  // Usuario
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_INACTIVE = 'USER_INACTIVE',
  
  // Sistema
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

// =====================================================
// 🔧 FUNCIONES DE MANEJO DE ERRORES
// =====================================================

/**
 * 🚨 Crear error del sistema
 */
export function createAppError(
  code: ErrorCodes,
  message: string,
  details?: any,
  user_id?: string,
  action?: string
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
    user_id,
    action
  };
}

/**
 * 📝 Log de error con contexto
 */
export function logError(error: AppError, context?: string): void {
  const logMessage = {
    level: 'ERROR',
    timestamp: error.timestamp,
    code: error.code,
    message: error.message,
    user_id: error.user_id,
    action: error.action,
    context,
    details: error.details
  };

  // Log en consola para desarrollo
  console.error('🚨 [ERROR]', logMessage);

  // Aquí se podría integrar con servicios de logging como:
  // - Sentry
  // - LogRocket
  // - DataDog
  // - Winston
}

/**
 * 🔄 Formatear error para respuesta API
 */
export function formatErrorResponse(error: AppError): ErrorResponse {
  // Log del error
  logError(error);

  // Determinar si mostrar detalles al usuario
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isInternalError = error.code === ErrorCodes.INTERNAL_SERVER_ERROR;

  return {
    success: false,
    error: isInternalError && !isDevelopment 
      ? 'Error interno del servidor' 
      : error.message,
    code: error.code,
    details: isDevelopment ? error.details : undefined
  };
}

/**
 * 🛡️ Manejar errores de Supabase
 */
export function handleSupabaseError(error: any, action: string): AppError {
  console.error('❌ [SUPABASE ERROR]', { error, action });

  // Mapear errores de Supabase a códigos del sistema
  if (error.code === 'PGRST116') {
    return createAppError(
      ErrorCodes.AUTH_REQUIRED,
      'Sesión requerida',
      { supabase_error: error },
      undefined,
      action
    );
  }

  if (error.code === '23505') {
    return createAppError(
      ErrorCodes.DATABASE_CONSTRAINT_ERROR,
      'Registro duplicado',
      { supabase_error: error },
      undefined,
      action
    );
  }

  if (error.code === '23503') {
    return createAppError(
      ErrorCodes.DATABASE_CONSTRAINT_ERROR,
      'Violación de clave foránea',
      { supabase_error: error },
      undefined,
      action
    );
  }

  // Error genérico de base de datos
  return createAppError(
    ErrorCodes.DATABASE_QUERY_ERROR,
    'Error en base de datos',
    { supabase_error: error },
    undefined,
    action
  );
}

/**
 * 🔐 Manejar errores de autenticación
 */
export function handleAuthError(error: any, action: string): AppError {
  console.error('❌ [AUTH ERROR]', { error, action });

  if (error.message?.includes('Invalid login credentials')) {
    return createAppError(
      ErrorCodes.AUTH_INVALID_CREDENTIALS,
      'Credenciales inválidas',
      { auth_error: error },
      undefined,
      action
    );
  }

  if (error.message?.includes('Email not confirmed')) {
    return createAppError(
      ErrorCodes.AUTH_PERMISSION_DENIED,
      'Email no confirmado',
      { auth_error: error },
      undefined,
      action
    );
  }

  return createAppError(
    ErrorCodes.AUTH_REQUIRED,
    'Error de autenticación',
    { auth_error: error },
    undefined,
    action
  );
}

/**
 * ✅ Manejar errores de validación
 */
export function handleValidationError(
  field: string,
  message: string,
  action: string
): AppError {
  return createAppError(
    ErrorCodes.API_VALIDATION_ERROR,
    `Error de validación en ${field}: ${message}`,
    { field, message },
    undefined,
    action
  );
}

/**
 * 🚀 Wrapper para manejo automático de errores en APIs
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  action: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = createAppError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Error interno del servidor',
        { original_error: error },
        undefined,
        action
      );
      
      logError(appError);
      throw appError;
    }
  };
}

/**
 * 📊 Obtener estadísticas de errores
 */
export function getErrorStats(): {
  total_errors: number;
  errors_by_code: Record<string, number>;
  recent_errors: AppError[];
} {
  // En un sistema real, esto vendría de una base de datos de logs
  return {
    total_errors: 0,
    errors_by_code: {},
    recent_errors: []
  };
}

/**
 * 🔔 Notificar errores críticos
 */
export function notifyCriticalError(error: AppError): void {
  // En un sistema real, esto enviaría notificaciones a:
  // - Slack
  // - Email
  // - SMS
  // - PagerDuty
  
  console.error('🚨 [CRITICAL ERROR]', {
    code: error.code,
    message: error.message,
    timestamp: error.timestamp,
    user_id: error.user_id,
    action: error.action
  });
}

// =====================================================
// ✅ MANEJO DE ERRORES COMPLETADO
// =====================================================
// ✅ Tipos de errores definidos
// ✅ Logging integrado
// ✅ Formateo de respuestas
// ✅ Manejo específico por servicio
// ✅ Wrapper automático
// =====================================================
