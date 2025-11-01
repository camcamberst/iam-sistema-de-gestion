'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { History, ArrowLeft, Calendar, DollarSign } from 'lucide-react';

interface Period {
  period_date: string;
  period_type: string;
  archived_at: string;
  platforms: Array<{
    platform_id: string;
    platform_name: string;
    platform_currency: string;
    value: number;
  }>;
  total_value: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export default function CalculatorHistorialPage() {
  const [user, setUser] = useState<User | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obtener usuario autenticado
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        
        if (!uid) {
          setError('No hay usuario autenticado');
          setLoading(false);
          return;
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', uid)
          .single();

        if (!userRow) {
          setError('Usuario no encontrado');
          setLoading(false);
          return;
        }

        // 🔒 VERIFICACIÓN DE SEGURIDAD: Solo permitir que el usuario vea sus propios datos
        // Verificar que el usuario autenticado coincide con el usuario de la base de datos
        if (uid !== userRow.id) {
          console.error('🚫 [CALCULATOR-HISTORIAL] Intento de acceso no autorizado detectado en frontend');
          setError('No autorizado: Solo puedes consultar tu propio historial');
          setLoading(false);
          return;
        }

        setUser({
          id: userRow.id,
          name: userRow.name || userRow.email?.split('@')[0] || 'Usuario',
          email: userRow.email || ''
        });

        // Obtener historial de calculadora con token de autorización
        // 🔒 GARANTIZAR: Siempre usar el ID del usuario autenticado, nunca uno diferente
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        
        if (!token) {
          setError('Sesión no válida. Por favor, inicia sesión nuevamente.');
          setLoading(false);
          return;
        }
        
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`
        };
        
        // 🔒 FORZAR: Usar siempre el ID del usuario autenticado
        const response = await fetch(`/api/model/calculator/historial?modelId=${userRow.id}`, {
          headers
        });
        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Error al cargar historial');
          return;
        }

        setPeriods(data.periods || []);

      } catch (err: any) {
        console.error('Error cargando historial:', err);
        setError(err.message || 'Error al cargar historial');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPeriodType = (periodType: string) => {
    return periodType === '1-15' ? '1ra Quincena' : '2da Quincena';
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : currency === 'EUR' ? 'EUR' : currency === 'GBP' ? 'GBP' : 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando historial...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => window.history.back()}
            className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Volver</span>
          </button>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-1 whitespace-nowrap truncate">
              Mi Historial
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm truncate">
              Historial de períodos archivados de Mi Calculadora
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-red-200 dark:border-red-600/20 p-6 mb-4">
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Error</h4>
            <p className="text-gray-500 dark:text-gray-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!error && periods.length === 0 && (
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-12 mb-4">
          <div className="text-center">
            <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No hay períodos archivados
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Aún no tienes períodos cerrados en tu historial de calculadora.
            </p>
          </div>
        </div>
      )}

      {/* Periods List */}
      {!error && periods.length > 0 && (
        <div className="space-y-4">
          {periods.map((period, index) => (
            <div
              key={`${period.period_date}-${period.period_type}`}
              className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 hover:shadow-md transition-all duration-300"
            >
              {/* Period Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {formatDate(period.period_date)} - {formatPeriodType(period.period_type)}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Archivado: {formatDate(period.archived_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(period.total_value)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Total del período</div>
                </div>
              </div>

              {/* Platforms List */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Plataformas ({period.platforms.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {period.platforms.map((platform) => (
                    <div
                      key={platform.platform_id}
                      className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {platform.platform_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {platform.platform_currency}
                          </p>
                        </div>
                        <div className="ml-3 text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(platform.value, platform.platform_currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

