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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Crear Nueva Plataforma
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Define los criterios y fórmulas de conversión para la nueva plataforma
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Información Básica</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  ID de Plataforma *
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="ej: nuevaplataforma"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  pattern="[a-z0-9_-]+"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Solo letras minúsculas, números, guiones y guiones bajos
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej: Nueva Plataforma"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional de la plataforma"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Tipo y Configuración */}
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Tipo y Fórmula de Conversión</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Tipo de Plataforma *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PlatformType })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="tokens">Tokens (ej: Chaturbate, MyFreeCams)</option>
                  <option value="credits">Créditos con Descuento (ej: CMD, Camlust)</option>
                  <option value="currency">Divisa (EUR/GBP) con Impuestos/Descuentos</option>
                  <option value="direct">Pago Directo 100% (ej: SUPERFOON)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Moneda Base *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="USD">USD (Dólar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (Libra Esterlina)</option>
                </select>
              </div>

              {/* Campos condicionales según tipo */}
              {formData.type === 'tokens' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Tasa de Conversión de Tokens *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={formData.token_rate}
                    onChange={(e) => setFormData({ ...formData, token_rate: e.target.value })}
                    placeholder="ej: 0.05 (100 tokens = 5 USD)"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    USD por 1 token (ej: 0.05 significa 100 tokens = 5 USD)
                  </p>
                </div>
              )}

              {formData.type === 'credits' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Factor de Descuento *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.discount_factor}
                    onChange={(e) => setFormData({ ...formData, discount_factor: e.target.value })}
                    placeholder="ej: 0.75 (25% descuento)"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Factor multiplicador (0.75 = 75% del valor, 25% descuento)
                  </p>
                </div>
              )}

              {formData.type === 'currency' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Factor de Descuento (Opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formData.discount_factor}
                      onChange={(e) => setFormData({ ...formData, discount_factor: e.target.value })}
                      placeholder="ej: 0.78 (22% descuento)"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Tasa de Impuesto (Opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      placeholder="ej: 0.16 (16% impuesto)"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Tasa de impuesto (0.16 = 16% impuesto, se aplica como 1 - 0.16 = 0.84)
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Frecuencia de Pago
                </label>
                <select
                  value={formData.payment_frequency}
                  onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mensajes de Error/Success */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">
                ✅ Plataforma creada exitosamente. Redirigiendo...
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {loading ? 'Creando...' : 'Crear Plataforma'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

