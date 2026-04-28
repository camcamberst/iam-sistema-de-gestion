// =====================================================
// 💬 COMPONENTE DE MENSAJES DE VALIDACIÓN
// =====================================================
// Componente reutilizable para mostrar errores y advertencias
// =====================================================

import React from 'react';

export interface ValidationMessageProps {
  errors?: string[];
  warnings?: string[];
  className?: string;
  showIcon?: boolean;
}

export function ValidationMessage({ 
  errors = [], 
  warnings = [], 
  className = '',
  showIcon = true 
}: ValidationMessageProps) {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Errores */}
      {errors.length > 0 && (
        <div className="flex items-start space-x-2">
          {showIcon && (
            <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <div className="space-y-1">
            {errors.map((error, index) => (
              <div key={index} className="text-red-400 text-sm">
                {error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advertencias */}
      {warnings.length > 0 && (
        <div className="flex items-start space-x-2">
          {showIcon && (
            <svg className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <div className="space-y-1">
            {warnings.map((warning, index) => (
              <div key={index} className="text-yellow-400 text-sm">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// 📊 COMPONENTE DE INDICADOR DE VALIDACIÓN
// =====================================================

export interface ValidationIndicatorProps {
  isValid: boolean;
  isDirty: boolean;
  className?: string;
}

export function ValidationIndicator({ 
  isValid, 
  isDirty, 
  className = '' 
}: ValidationIndicatorProps) {
  if (!isDirty) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {isValid ? (
        <>
          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-green-400 text-sm">Válido</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-red-400 text-sm">Inválido</span>
        </>
      )}
    </div>
  );
}

// =====================================================
// 📝 COMPONENTE DE CAMPO CON VALIDACIÓN
// =====================================================

export interface ValidatedFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  errors?: string[];
  warnings?: string[];
  showValidation?: boolean;
  className?: string;
}

export function ValidatedField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  errors = [],
  warnings = [],
  showValidation = true,
  className = ''
}: ValidatedFieldProps) {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasValidation = hasErrors || hasWarnings;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-gray-300 text-sm font-medium">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full bg-gray-800 border rounded-lg px-3 py-2 text-white
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors duration-200
            ${hasErrors 
              ? 'border-red-500 focus:ring-red-500' 
              : hasWarnings 
                ? 'border-yellow-500 focus:ring-yellow-500'
                : 'border-gray-600 focus:border-blue-500'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {showValidation && hasValidation && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {hasErrors ? (
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
      </div>

      {showValidation && (
        <ValidationMessage 
          errors={errors} 
          warnings={warnings} 
        />
      )}
    </div>
  );
}
