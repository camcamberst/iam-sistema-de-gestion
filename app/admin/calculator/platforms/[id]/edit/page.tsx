"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlatformType = 'tokens' | 'credits' | 'currency' | 'direct';

export default function EditPlatformPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
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
    payment_frequency: 'quincenal',
    login_url: ''
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

  // Cargar datos de la plataforma
  useEffect(() => {
    async function fetchPlatform() {
      if (!id || !currentUser) return;
      
      try {
        setFetching(true);
        // Cargamos todas las plataformas y filtramos
        const response = await fetch('/api/calculator/platforms');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error);
        }

        const platform = data.config.platforms.find((p: any) => p.id === id);
        
        if (!platform) {
          throw new Error('Plataforma no encontrada');
        }

        // Determinar tipo basado en datos
        let type: PlatformType = 'tokens';
        if (platform.token_rate) type = 'tokens';
        else if (platform.direct_payout) type = 'direct';
        else if (platform.currency === 'USD' && platform.discount_factor) type = 'credits'; // Asumiendo credits es USD con descuento
        else if (['EUR', 'GBP'].includes(platform.currency)) type = 'currency';

        setFormData({
          name: platform.name,
          description: platform.description || '',
          type,
          currency: platform.currency,
          token_rate: platform.token_rate?.toString() || '',
          discount_factor: platform.discount_factor?.toString() || '',
          tax_rate: platform.tax_rate?.toString() || '',
          direct_payout: platform.direct_payout,
          payment_frequency: platform.payment_frequency || 'quincenal',
          login_url: platform.login_url || ''
        });

      } catch (err: any) {
        setError(err.message);
      } finally {
        setFetching(false);
      }
    }

    if (!authLoading) {
      fetchPlatform();
    }
  }, [id, authLoading, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      // Preparar datos base
      const platformData: any = {
        id, // El ID se mantiene
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        currency: formData.currency,
        payment_frequency: formData.payment_frequency,
        direct_payout: formData.direct_payout,
        login_url: formData.login_url.trim() || null,
        updated_by: currentUser.id
      };

      // Agregar campos según tipo seleccionado
      if (formData.type === 'tokens') {
        if (!formData.token_rate) {
          throw new Error('Tasa de conversión de tokens es requerida');
        }
        platformData.token_rate = parseFloat(formData.token_rate);
        platformData.discount_factor = null;
        platformData.tax_rate = null;
        platformData.direct_payout = false;
      } else if (formData.type === 'credits') {
        if (!formData.discount_factor) {
          throw new Error('Factor de descuento es requerido');
        }
        platformData.discount_factor = parseFloat(formData.discount_factor);
        platformData.token_rate = null;
        platformData.tax_rate = null;
        platformData.direct_payout = false;
      } else if (formData.type === 'currency') {
        if (formData.discount_factor) {
          platformData.discount_factor = parseFloat(formData.discount_factor);
        } else {
          platformData.discount_factor = null;
        }
        if (formData.tax_rate) {
          platformData.tax_rate = parseFloat(formData.tax_rate);
        } else {
          platformData.tax_rate = null;
        }
        platformData.token_rate = null;
        platformData.direct_payout = false;
      } else if (formData.type === 'direct') {
        platformData.direct_payout = true;
        platformData.token_rate = null;
        platformData.discount_factor = null;
        platformData.tax_rate = null;
      }

      const response = await fetch('/api/calculator/platforms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platformData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al actualizar plataforma');
      }

      setSuccess(true);
      
      // Marcar que se hizo un cambio en las plataformas para que "Portafolio Modelos" recargue
      sessionStorage.setItem('platforms_updated', Date.now().toString());
      
      setTimeout(() => {
        router.push('/admin/calculator/platforms');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Error al actualizar plataforma');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || fetching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Editar Plataforma: {formData.name || '...'}
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      ID: <span className="font-mono">{id}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario Horizontal */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
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
              </div>

              <div className="md:col-span-2">
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
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PlatformType })}
                  className="apple-input"
                  required
                >
                  <option value="tokens">Tokens (ej: Chaturbate)</option>
                  <option value="credits">Créditos con Descuento (ej: CMD)</option>
                  <option value="currency">Divisa (EUR/GBP)</option>
                  <option value="direct">Pago Directo 100%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Moneda Base *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="apple-input"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Tasa de Conversión de Tokens *
                  </label>
                  <div className="relative">
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
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    USD por 1 token (0.05 = 100 tokens = 5 USD)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="apple-input"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0.75 = 75% del valor (25% descuento)
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="apple-input"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0.16 = 16% impuesto
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="apple-input"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
              </div>
            )}

            {formData.type === 'direct' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Frecuencia de Pago
                  </label>
                  <select
                    value={formData.payment_frequency}
                    onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                    className="apple-input"
                  >
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </div>
                <div className="flex items-end mb-1.5">
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Pago directo 100% para la modelo (sin conversiones)
                  </p>
                </div>
              </div>
            )}

            {/* Campo de URL de Login (común para todas las plataformas) */}
            <div className="mb-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  URL de Login de la Plataforma
                </label>
                <input
                  type="url"
                  value={formData.login_url}
                  onChange={(e) => setFormData({ ...formData, login_url: e.target.value })}
                  placeholder="https://ejemplo.com/login"
                  className="apple-input"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Este URL será usado por todas las modelos de esta plataforma
                </p>
              </div>
            </div>

            {/* Mensajes de Error/Success */}
            {(error || success) && (
              <div className={`rounded-lg p-4 mb-6 flex items-center gap-3 ${
                error 
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                  : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              }`}>
                {error ? (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <p className={`text-sm font-medium ${
                  error 
                    ? 'text-red-800 dark:text-red-200' 
                    : 'text-green-800 dark:text-green-200'
                }`}>
                  {error || '✅ Plataforma actualizada exitosamente. Redirigiendo...'}
                </p>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </span>
                ) : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
