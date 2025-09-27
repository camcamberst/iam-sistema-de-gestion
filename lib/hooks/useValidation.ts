// =====================================================
// 🎣 HOOKS DE VALIDACIÓN EN TIEMPO REAL
// =====================================================
// Hooks personalizados para validación en React
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { ValidationResult, createRealTimeValidator } from '../validation';

export interface UseValidationOptions {
  debounceMs?: number;
  validateOnMount?: boolean;
}

export interface UseValidationReturn<T> {
  data: T;
  setData: (data: T | ((prev: T) => T)) => void;
  validation: ValidationResult;
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  isDirty: boolean;
  reset: () => void;
}

// =====================================================
// 🎣 HOOK PRINCIPAL DE VALIDACIÓN
// =====================================================

export function useValidation<T>(
  initialData: T,
  validationFn: (data: T) => ValidationResult,
  options: UseValidationOptions = {}
): UseValidationReturn<T> {
  const { debounceMs = 300, validateOnMount = false } = options;
  
  const [data, setData] = useState<T>(initialData);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [] });
  const [isDirty, setIsDirty] = useState(false);

  // Crear validador en tiempo real
  const realTimeValidator = useCallback(
    createRealTimeValidator(validationFn, debounceMs),
    [validationFn, debounceMs]
  );

  // Validar cuando cambian los datos
  useEffect(() => {
    if (isDirty || validateOnMount) {
      realTimeValidator(data, setValidation);
    }
  }, [data, realTimeValidator, isDirty, validateOnMount]);

  // Manejar cambios en los datos
  const handleSetData = useCallback((newData: T | ((prev: T) => T)) => {
    setData(newData);
    setIsDirty(true);
  }, []);

  // Resetear formulario
  const reset = useCallback(() => {
    setData(initialData);
    setValidation({ isValid: true, errors: [] });
    setIsDirty(false);
  }, [initialData]);

  return {
    data,
    setData: handleSetData,
    validation,
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
    isDirty,
    reset
  };
}

// =====================================================
// 🎣 HOOK PARA VALIDACIÓN DE EMAIL
// =====================================================

export function useEmailValidation(initialEmail: string = '') {
  const [email, setEmail] = useState(initialEmail);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [] });

  useEffect(() => {
    if (email) {
      import('../validation').then(({ validateEmail }) => {
        const result = validateEmail(email);
        setValidation(result);
      });
    }
  }, [email]);

  return {
    email,
    setEmail,
    validation,
    isValid: validation.isValid,
    errors: validation.errors
  };
}

// =====================================================
// 🎣 HOOK PARA VALIDACIÓN DE CONTRASEÑA
// =====================================================

export function usePasswordValidation(initialPassword: string = '') {
  const [password, setPassword] = useState(initialPassword);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: [] });

  useEffect(() => {
    if (password) {
      import('../validation').then(({ validatePassword }) => {
        const result = validatePassword(password);
        setValidation(result);
      });
    }
  }, [password]);

  return {
    password,
    setPassword,
    validation,
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings
  };
}

// =====================================================
// 🎣 HOOK PARA VALIDACIÓN DE USUARIO
// =====================================================

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  group_ids: string[];
}

export function useUserValidation(initialData: UserFormData) {
  return useValidation(
    initialData,
    (data) => {
      // Importación síncrona para evitar problemas de tipo
      const { validateUser } = require('../validation');
      return validateUser(data);
    },
    { validateOnMount: false }
  );
}

// =====================================================
// 🎣 HOOK PARA VALIDACIÓN DE GRUPO
// =====================================================

export interface GroupFormData {
  name: string;
  description: string;
}

export function useGroupValidation(initialData: GroupFormData) {
  return useValidation(
    initialData,
    (data) => {
      // Importación síncrona para evitar problemas de tipo
      const { validateGroup } = require('../validation');
      return validateGroup(data);
    },
    { validateOnMount: false }
  );
}

// =====================================================
// 🎣 HOOK PARA VALIDACIÓN DE FORMULARIOS
// =====================================================

export interface FormValidationState {
  isValid: boolean;
  isDirty: boolean;
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
}

export function useFormValidation<T extends Record<string, any>>(
  initialData: T,
  validationRules: Record<keyof T, (value: any) => ValidationResult>
) {
  const [data, setData] = useState<T>(initialData);
  const [validation, setValidation] = useState<FormValidationState>({
    isValid: true,
    isDirty: false,
    errors: {},
    warnings: {}
  });

  const validateField = useCallback(async (field: keyof T, value: any) => {
    const validator = validationRules[field];
    if (validator) {
      const result = await validator(value);
      setValidation(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field as string]: result.errors
        },
        warnings: result.warnings ? {
          ...prev.warnings,
          [field as string]: result.warnings
        } : prev.warnings
      }));
    }
  }, [validationRules]);

  const validateAll = useCallback(async () => {
    const errors: Record<string, string[]> = {};
    const warnings: Record<string, string[]> = {};
    let isValid = true;

    for (const [field, validator] of Object.entries(validationRules)) {
      const result = await validator(data[field as keyof T]);
      if (!result.isValid) {
        errors[field] = result.errors;
        isValid = false;
      }
      if (result.warnings) {
        warnings[field] = result.warnings;
      }
    }

    setValidation({
      isValid,
      isDirty: true,
      errors,
      warnings: Object.keys(warnings).length > 0 ? warnings : undefined
    });
  }, [data, validationRules]);

  const setField = useCallback((field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setValidation(prev => ({ ...prev, isDirty: true }));
    validateField(field, value);
  }, [validateField]);

  const reset = useCallback(() => {
    setData(initialData);
    setValidation({
      isValid: true,
      isDirty: false,
      errors: {},
      warnings: {}
    });
  }, [initialData]);

  return {
    data,
    setData,
    setField,
    validation,
    validateAll,
    reset
  };
}
