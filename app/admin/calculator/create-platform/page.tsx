"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

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
    id: '',
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

      // Preparar datos según tipo
      const platformData: any = {
        id: formData.id.toLowerCase().trim(),
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Header Compacto */}
        <div className="mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Crear Nueva Plataforma
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Define los criterios y fórmulas de conversión
              </p>
            </div>
          </div>
        </div>

        {/* Formulario Horizontal */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-600/20 shadow-lg">
            {/* Primera Fila: Información Básica */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                  ID de Plataforma *
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="ej: nuevaplataforma"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  pattern="[a-z0-9_-]+"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Solo minúsculas, números, guiones
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej: Nueva Plataforma"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Descripción
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Segunda Fila: Tipo y Moneda */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Tipo de Plataforma *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PlatformType })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="tokens">Tokens (ej: Chaturbate)</option>
                  <option value="credits">Créditos con Descuento (ej: CMD)</option>
                  <option value="currency">Divisa (EUR/GBP)</option>
                  <option value="direct">Pago Directo 100%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Moneda Base *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="USD">USD (Dólar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (Libra Esterlina)</option>
                </select>
              </div>
            </div>

            {/* Tercera Fila: Campos según Tipo */}
            {formData.type === 'tokens' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
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
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    USD por 1 token (0.05 = 100 tokens = 5 USD)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
              </div>
            )}

            {formData.type === 'credits' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
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
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    0.75 = 75% del valor (25% descuento)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
              </div>
            )}

            {formData.type === 'currency' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
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
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
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
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    0.16 = 16% impuesto
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
              </div>
            )}

            {formData.type === 'direct' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
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

            {/* Botones */}
            <div className="flex gap-3 justify-end pt-2 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {loading ? 'Creando...' : 'Crear Plataforma'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

