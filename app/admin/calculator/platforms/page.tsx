'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Platform {
  id: string;
  name: string;
  description: string;
  currency: string;
  token_rate: number | null;
  discount_factor: number | null;
  tax_rate: number | null;
  direct_payout: boolean;
  payment_frequency: 'quincenal' | 'mensual';
  active: boolean;
}

export default function PlatformsListPage() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
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
      await loadPlatforms();
    } catch (err) {
      console.error('Error de autenticación:', err);
      router.push('/admin/dashboard');
    }
  };

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/calculator/platforms');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar plataformas');
      }

      setPlatforms(data.config.platforms || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la plataforma "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/calculator/platforms?id=${id}&deleted_by=${currentUser.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      // Recargar lista
      await loadPlatforms();
      
      // Marcar que se hizo un cambio en las plataformas para que "Portafolio Modelos" recargue
      sessionStorage.setItem('platforms_updated', Date.now().toString());
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !platforms.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando plataformas...</p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Gestión de Plataformas
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                      Administra las plataformas disponibles en la calculadora
                    </p>
                  </div>
                </div>
                
                <Link
                  href="/admin/calculator/create-platform"
                  className="w-full md:w-auto px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-[1.02] md:hover:scale-105 font-medium text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Nueva Plataforma</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Tabla de Plataformas */}
        <div className="relative bg-white/70 dark:bg-gray-800/80 backdrop-blur-sm border border-white/20 dark:border-gray-600/40 rounded-xl shadow-md transition-all duration-300 apple-scroll overflow-y-auto max-h-[70vh] p-0 z-10 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <div className="pt-4 sm:pt-6 px-3 sm:px-6 pb-0">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Plataformas ({platforms.length})
              </h2>
            </div>
            
            {platforms.length === 0 && !loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400">No hay plataformas activas.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full text-left text-xs md:table-fixed">
                      <thead className="border-b border-white/20 dark:border-gray-600/40 bg-gradient-to-r from-gray-50/80 to-blue-50/60 dark:from-gray-700/90 dark:to-gray-600/70 backdrop-blur-sm">
                        <tr>
                          <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[140px] sm:w-[25%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-left">
                            Plataforma
                          </th>
                          <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[100px] sm:w-[18%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                            Tipo / Moneda
                          </th>
                          <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[120px] sm:w-[25%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-left">
                            Configuración
                          </th>
                          <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[100px] sm:w-[15%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center">
                            Frecuencia
                          </th>
                          <th className="px-2 sm:px-4 py-3 sm:py-4 min-w-[100px] sm:w-[17%] text-gray-700 dark:text-white font-medium text-xs sm:text-sm uppercase tracking-wide text-center sm:text-right">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/30 dark:bg-gray-800/50 backdrop-blur-sm divide-y divide-white/20 dark:divide-gray-700/50">
                        {platforms.map((platform) => {
                          // Determinar tipo
                          let type = 'Estándar';
                          if (platform.token_rate) type = 'Tokens';
                          else if (platform.direct_payout) type = 'Pago Directo';
                          
                          return (
                            <tr key={platform.id} className="border-b border-white/10 dark:border-gray-700/50 hover:bg-white/60 dark:hover:bg-gray-700/70 hover:shadow-sm transition-all duration-200 h-auto sm:h-12 group">
                              <td className="px-2 sm:px-4 py-2">
                                <div className="flex items-center space-x-2">
                                  <div className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-sm sm:text-lg border border-blue-200 dark:border-blue-700/50">
                                    {platform.name.charAt(0)}
                                  </div>
                                  <div className="ml-2 sm:ml-4 min-w-0">
                                    <div className="font-medium text-gray-900 dark:text-white text-xs sm:text-sm truncate">{platform.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-300 font-mono text-[10px] sm:text-xs truncate">{platform.id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2">
                                <div className="flex flex-col items-center text-center">
                                  <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{platform.currency}</span>
                                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-300">{type}</span>
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2">
                                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-200 space-y-0.5 sm:space-y-1 text-center">
                                  {platform.token_rate && (
                                    <div>Token: <span className="font-mono">{platform.token_rate}</span></div>
                                  )}
                                  {platform.discount_factor && (
                                    <div>Desc: <span className="font-mono">{(platform.discount_factor * 100).toFixed(1)}%</span></div>
                                  )}
                                  {platform.tax_rate && (
                                    <div>Imp: <span className="font-mono">{(platform.tax_rate * 100).toFixed(1)}%</span></div>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2">
                                <div className="flex items-center justify-center">
                                  <span className={`inline-flex items-center justify-center min-w-[70px] sm:min-w-[80px] px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium border ${
                                    platform.payment_frequency === 'quincenal' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-700/50'
                                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700/50'
                                  }`}>
                                    {platform.payment_frequency}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-2">
                                <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3">
                                  <Link
                                    href={`/admin/calculator/platforms/${platform.id}/edit`}
                                    className="text-blue-600 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 font-medium text-xs sm:text-sm transition-colors touch-manipulation"
                                  >
                                    Editar
                                  </Link>
                                  <button
                                    onClick={() => handleDelete(platform.id, platform.name)}
                                    disabled={deletingId === platform.id}
                                    className="text-red-600 hover:text-red-900 dark:text-red-300 dark:hover:text-red-200 font-medium text-xs sm:text-sm disabled:opacity-50 transition-colors touch-manipulation"
                                  >
                                    {deletingId === platform.id ? '...' : 'Eliminar'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
