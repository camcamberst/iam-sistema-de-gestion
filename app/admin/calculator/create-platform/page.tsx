"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import AppleDropdown from '@/components/ui/AppleDropdown';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlatformType = 'tokens' | 'credits' | 'currency' | 'direct';

export default function CreatePlatformPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estados del formulario
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'tokens' as PlatformType,
    currency: 'USD',
    token_rate: '',
    discount_factor: '',
    tax_rate: '',
    direct_payout: false,
    payment_frequency: 'quincenal'
  });

  // Función para generar ID automáticamente desde el nombre
  const generateIdFromName = (name: string): string => {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, '') // Eliminar caracteres especiales
      .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
      .replace(/_{2,}/g, '_') // Reemplazar múltiples guiones bajos con uno solo
      .replace(/^_+|_+$/g, ''); // Eliminar guiones bajos al inicio y final
  };

  // Validar autenticación y permisos
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', user.id)
          .single();

        if (userError || !userData || userData.role !== 'super_admin') {
          router.push('/admin/dashboard');
          return;
        }

        setCurrentUser(userData);
        setAuthLoading(false);
      } catch (err) {
        console.error('Error checking auth:', err);
        router.push('/admin/dashboard');
      }
    }
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Generar ID automáticamente desde el nombre
      const generatedId = generateIdFromName(formData.name);
      
      if (!generatedId) {
        throw new Error('El nombre de la plataforma es requerido para generar el ID');
      }

      // Preparar datos según tipo
      const platformData: any = {
        id: generatedId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        currency: formData.currency,
        payment_frequency: formData.payment_frequency,
        direct_payout: formData.direct_payout,
        created_by: currentUser.id
      };

      // Agregar campos según tipo
      if (formData.type === 'tokens') {
        if (!formData.token_rate) {
          throw new Error('Tasa de conversión de tokens es requerida');
        }
        platformData.token_rate = parseFloat(formData.token_rate);
        platformData.discount_factor = null;
        platformData.tax_rate = null;
      } else if (formData.type === 'credits') {
        if (!formData.discount_factor) {
          throw new Error('Factor de descuento es requerido');
        }
        platformData.discount_factor = parseFloat(formData.discount_factor);
        platformData.token_rate = null;
        platformData.tax_rate = null;
      } else if (formData.type === 'currency') {
        if (formData.discount_factor) {
          platformData.discount_factor = parseFloat(formData.discount_factor);
        }
        if (formData.tax_rate) {
          platformData.tax_rate = parseFloat(formData.tax_rate);
        }
        platformData.token_rate = null;
      } else if (formData.type === 'direct') {
        platformData.direct_payout = true;
        platformData.token_rate = null;
        platformData.discount_factor = null;
        platformData.tax_rate = null;
      }

      const response = await fetch('/api/calculator/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platformData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear plataforma');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/calculator/config');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Error al crear plataforma');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-16 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500/80 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wide">Verificando permisos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 pt-16">
      {/* Título alineado al formulario */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center gap-3 px-1 sm:px-2">
        <svg className="w-5 h-5 text-indigo-500/80 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
          Crear Nueva Plataforma
        </h1>
      </div>

      {/* Formulario Horizontal */}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl mx-auto">
        <div className="bg-white/60 dark:bg-[#0a0f1a]/60 backdrop-blur-md border border-gray-200/50 dark:border-white/5 rounded-2xl shadow-sm p-4 sm:p-6">
            {/* Primera Fila: Información Básica */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Nombre de la Plataforma *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej: Nueva Plataforma"
                  className="apple-input"
                  required
                />
                {formData.name && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    ID generado: <span className="font-mono text-blue-600 dark:text-blue-400">{generateIdFromName(formData.name)}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional"
                  className="apple-input"
                />
              </div>
            </div>

            {/* Segunda Fila: Tipo y Moneda */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Tipo de Plataforma *
                </label>
                <AppleDropdown
                  options={[
                    { value: 'tokens', label: 'Tokens (ej: Chaturbate)' },
                    { value: 'credits', label: 'Créditos con Descuento (ej: CMD)' },
                    { value: 'currency', label: 'Divisa (EUR/GBP)' },
                    { value: 'direct', label: 'Pago Directo 100%' }
                  ]}
                  value={formData.type}
                  onChange={(value) => setFormData({ ...formData, type: value as PlatformType })}
                  placeholder="Selecciona el tipo"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Moneda Base *
                </label>
                <AppleDropdown
                  options={[
                    { value: 'USD', label: 'USD (Dólar)' },
                    { value: 'EUR', label: 'EUR (Euro)' },
                    { value: 'GBP', label: 'GBP (Libra Esterlina)' }
                  ]}
                  value={formData.currency}
                  onChange={(value) => setFormData({ ...formData, currency: value })}
                  placeholder="Selecciona la moneda"
                />
              </div>
            </div>

            {/* Tercera Fila: Campos según Tipo */}
            {formData.type === 'tokens' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Tasa de Conversión de Tokens *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={formData.token_rate}
                    onChange={(e) => setFormData({ ...formData, token_rate: e.target.value })}
                    placeholder="ej: 0.05"
                    className="apple-input"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    USD por 1 token (0.05 = 100 tokens = 5 USD)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <AppleDropdown
                    options={[
                      { value: 'quincenal', label: 'Quincenal' },
                      { value: 'mensual', label: 'Mensual' }
                    ]}
                    value={formData.payment_frequency}
                    onChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                    placeholder="Selecciona frecuencia"
                  />
                </div>
              </div>
            )}

            {formData.type === 'credits' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Factor de Descuento *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.discount_factor}
                    onChange={(e) => setFormData({ ...formData, discount_factor: e.target.value })}
                    placeholder="ej: 0.75"
                    className="apple-input"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    0.75 = 75% del valor (25% descuento)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <AppleDropdown
                    options={[
                      { value: 'quincenal', label: 'Quincenal' },
                      { value: 'mensual', label: 'Mensual' }
                    ]}
                    value={formData.payment_frequency}
                    onChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                    placeholder="Selecciona frecuencia"
                  />
                </div>
              </div>
            )}

            {formData.type === 'currency' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Factor de Descuento (Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.discount_factor}
                    onChange={(e) => setFormData({ ...formData, discount_factor: e.target.value })}
                    placeholder="ej: 0.78"
                    className="apple-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Tasa de Impuesto (Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                    placeholder="ej: 0.16"
                    className="apple-input"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    0.16 = 16% impuesto
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <AppleDropdown
                    options={[
                      { value: 'quincenal', label: 'Quincenal' },
                      { value: 'mensual', label: 'Mensual' }
                    ]}
                    value={formData.payment_frequency}
                    onChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                    placeholder="Selecciona frecuencia"
                  />
                </div>
              </div>
            )}

            {formData.type === 'direct' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <AppleDropdown
                    options={[
                      { value: 'quincenal', label: 'Quincenal' },
                      { value: 'mensual', label: 'Mensual' }
                    ]}
                    value={formData.payment_frequency}
                    onChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                    placeholder="Selecciona frecuencia"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pago directo 100% para la modelo
                  </p>
                </div>
              </div>
            )}

            {/* Mensajes de Error/Success */}
            {(error || success) && (
              <div className={`rounded-lg p-3 mb-4 ${
                error 
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                  : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              }`}>
                <p className={`text-sm ${
                  error 
                    ? 'text-red-800 dark:text-red-200' 
                    : 'text-green-800 dark:text-green-200'
                }`}>
                  {error || '✅ Plataforma creada exitosamente. Redirigiendo...'}
                </p>
              </div>
            )}

            {/* Botones dentro de Píldora Transparente */}
            <div className="flex justify-end pt-6 mt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-1 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-5 py-2 text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 text-[13px] font-bold text-white bg-gradient-to-r from-sky-500 to-fuchsia-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.4)] dark:shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:shadow-[0_0_25px_rgba(14,165,233,0.6)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creando...' : 'Crear Plataforma'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
  );
}

