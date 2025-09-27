// =====================================================
// 🔍 SISTEMA DE VALIDACIÓN ROBUSTA - SMART HOME
// =====================================================
// Validación centralizada para todos los datos del sistema
// =====================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationRule {
  field: string;
  value: any;
  rules: string[];
  customMessage?: string;
}

// =====================================================
// 📧 VALIDACIÓN DE EMAIL
// =====================================================

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('El email es requerido');
    return { isValid: false, errors };
  }

  // Normalizar email
  const normalizedEmail = email.toLowerCase().trim();
  
  // Validar formato básico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    errors.push('El formato del email no es válido');
    return { isValid: false, errors };
  }

  // Validar longitud
  if (normalizedEmail.length > 254) {
    errors.push('El email es demasiado largo (máximo 254 caracteres)');
    return { isValid: false, errors };
  }

  // Validar caracteres especiales
  const dangerousChars = /[<>\"'%;()&+]/.test(normalizedEmail);
  if (dangerousChars) {
    errors.push('El email contiene caracteres no permitidos');
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

// =====================================================
// 🔐 VALIDACIÓN DE CONTRASEÑA
// =====================================================

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!password) {
    errors.push('La contraseña es requerida');
    return { isValid: false, errors };
  }

  // Longitud mínima
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }

  // Longitud máxima
  if (password.length > 128) {
    errors.push('La contraseña es demasiado larga (máximo 128 caracteres)');
  }

  // Contener al menos una letra mayúscula
  if (!/[A-Z]/.test(password)) {
    warnings.push('Se recomienda incluir al menos una letra mayúscula');
  }

  // Contener al menos una letra minúscula
  if (!/[a-z]/.test(password)) {
    warnings.push('Se recomienda incluir al menos una letra minúscula');
  }

  // Contener al menos un número
  if (!/\d/.test(password)) {
    warnings.push('Se recomienda incluir al menos un número');
  }

  // Contener al menos un carácter especial
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    warnings.push('Se recomienda incluir al menos un carácter especial');
  }

  // No contener espacios
  if (/\s/.test(password)) {
    errors.push('La contraseña no puede contener espacios');
  }

  // No contener caracteres peligrosos
  const dangerousChars = /[<>\"'%;]/.test(password);
  if (dangerousChars) {
    errors.push('La contraseña contiene caracteres no permitidos');
  }

  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings: warnings.length > 0 ? warnings : undefined 
  };
}

// =====================================================
// 👤 VALIDACIÓN DE NOMBRE
// =====================================================

export function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name) {
    errors.push('El nombre es requerido');
    return { isValid: false, errors };
  }

  // Longitud mínima
  if (name.trim().length < 2) {
    errors.push('El nombre debe tener al menos 2 caracteres');
  }

  // Longitud máxima
  if (name.length > 100) {
    errors.push('El nombre es demasiado largo (máximo 100 caracteres)');
  }

  // Solo letras, espacios, guiones y apostrofes
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']+$/;
  if (!nameRegex.test(name)) {
    errors.push('El nombre solo puede contener letras, espacios, guiones y apostrofes');
  }

  // No puede empezar o terminar con espacios
  if (name !== name.trim()) {
    errors.push('El nombre no puede empezar o terminar con espacios');
  }

  return { isValid: errors.length === 0, errors };
}

// =====================================================
// 🏢 VALIDACIÓN DE ROL
// =====================================================

export function validateRole(role: string): ValidationResult {
  const errors: string[] = [];
  
  if (!role) {
    errors.push('El rol es requerido');
    return { isValid: false, errors };
  }

  const validRoles = ['super_admin', 'admin', 'modelo', 'chatter'];
  if (!validRoles.includes(role)) {
    errors.push(`El rol debe ser uno de: ${validRoles.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

// =====================================================
// 🏷️ VALIDACIÓN DE NOMBRE DE GRUPO
// =====================================================

export function validateGroupName(name: string): ValidationResult {
  const errors: string[] = [];
  
  if (!name) {
    errors.push('El nombre del grupo es requerido');
    return { isValid: false, errors };
  }

  // Longitud mínima
  if (name.trim().length < 2) {
    errors.push('El nombre del grupo debe tener al menos 2 caracteres');
  }

  // Longitud máxima
  if (name.length > 50) {
    errors.push('El nombre del grupo es demasiado largo (máximo 50 caracteres)');
  }

  // No puede empezar o terminar con espacios
  if (name !== name.trim()) {
    errors.push('El nombre del grupo no puede empezar o terminar con espacios');
  }

  // Solo letras, números, espacios y guiones
  const groupNameRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_]+$/;
  if (!groupNameRegex.test(name)) {
    errors.push('El nombre del grupo solo puede contener letras, números, espacios, guiones y guiones bajos');
  }

  return { isValid: errors.length === 0, errors };
}

// =====================================================
// 🔍 VALIDACIÓN DE USUARIO COMPLETO
// =====================================================

export interface UserValidationData {
  name: string;
  email: string;
  password: string;
  role: string;
  group_ids?: string[];
}

export function validateUser(userData: UserValidationData): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validar nombre
  const nameValidation = validateName(userData.name);
  if (!nameValidation.isValid) {
    allErrors.push(...nameValidation.errors);
  }

  // Validar email
  const emailValidation = validateEmail(userData.email);
  if (!emailValidation.isValid) {
    allErrors.push(...emailValidation.errors);
  }

  // Validar contraseña
  const passwordValidation = validatePassword(userData.password);
  if (!passwordValidation.isValid) {
    allErrors.push(...passwordValidation.errors);
  }
  if (passwordValidation.warnings) {
    allWarnings.push(...passwordValidation.warnings);
  }

  // Validar rol
  const roleValidation = validateRole(userData.role);
  if (!roleValidation.isValid) {
    allErrors.push(...roleValidation.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined
  };
}

// =====================================================
// 🏢 VALIDACIÓN DE GRUPO COMPLETO
// =====================================================

export interface GroupValidationData {
  name: string;
  description?: string;
}

export function validateGroup(groupData: GroupValidationData): ValidationResult {
  const allErrors: string[] = [];

  // Validar nombre
  const nameValidation = validateGroupName(groupData.name);
  if (!nameValidation.isValid) {
    allErrors.push(...nameValidation.errors);
  }

  // Validar descripción (opcional)
  if (groupData.description && groupData.description.length > 500) {
    allErrors.push('La descripción es demasiado larga (máximo 500 caracteres)');
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

// =====================================================
// 🚀 VALIDACIÓN EN TIEMPO REAL
// =====================================================

export function createRealTimeValidator<T>(
  validationFn: (data: T) => ValidationResult,
  debounceMs: number = 300
) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (data: T, callback: (result: ValidationResult) => void) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      const result = validationFn(data);
      callback(result);
    }, debounceMs);
  };
}

// =====================================================
// 📊 UTILIDADES DE VALIDACIÓN
// =====================================================

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>\"'%;]/g, '') // Remover caracteres peligrosos
    .replace(/\s+/g, ' '); // Normalizar espacios
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function validateOrganizationId(orgId: string): ValidationResult {
  const errors: string[] = [];
  
  if (!orgId) {
    errors.push('El ID de organización es requerido');
    return { isValid: false, errors };
  }

  if (!isValidUUID(orgId)) {
    errors.push('El ID de organización no es válido');
  }

  return { isValid: errors.length === 0, errors };
}
