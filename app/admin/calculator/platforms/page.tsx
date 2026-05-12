'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PageHeader from "@/components/ui/PageHeader";

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
      <div className="flex flex-col items-center justify-center min-h-[40vh] py-16 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500/80 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wide">Cargando plataformas...</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8 pt-16">
      {/* Header Minimalista */}
      <PageHeader
        title="Gestión de Plataformas"
        subtitle="Administra las plataformas del sistema"
        glow="admin"
        icon={
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        actions={
          <button
            onClick={() => router.push('/admin/calculator/create-platform')}
            className="w-full sm:w-auto btn-apple-primary flex items-center justify-center h-[34px] px-6 py-0 text-sm"
          >
            <span>Nueva Plataforma</span>
          </button>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabla de Plataformas - Regla Cards */}
      <div className="bg-white/60 dark:bg-[#0a0f1a]/60 backdrop-blur-md border border-gray-200/50 dark:border-white/5 rounded-2xl shadow-sm overflow-hidden apple-scroll overflow-x-auto p-2 sm:p-4">
        {platforms.length === 0 && !loading ? (
          <div className="text-center py-12">
            <svg className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No hay plataformas activas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden">
                <table className="min-w-full text-center text-xs md:table-fixed border-separate border-spacing-0">
                  <thead className="">
                    <tr>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[120px] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-left rounded-l-full pl-6">
                        Plataformas ({platforms.length})
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[120px] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Divisa/Tipo
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[120px] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Reglas
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[100px] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center">
                        Periodo
                      </th>
                      <th className="bg-black/[0.04] dark:bg-white/[0.04] px-2 sm:px-4 py-3 sm:py-3.5 min-w-[150px] text-gray-900 dark:text-white font-bold text-xs sm:text-[13px] capitalize tracking-tight text-center rounded-r-full pr-6">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {platforms.map((platform) => {
                      let type = 'Estándar';
                      if (platform.token_rate) type = 'Tokens';
                      else if (platform.direct_payout) type = 'Pago Directo';
                      
                      return (
                        <tr key={platform.id} className="group hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-all duration-200 h-auto sm:h-14">
                          <td className="px-2 sm:px-4 py-3 pl-6 text-left">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0 border border-black/5 dark:border-white/10">
                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{platform.name.charAt(0)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100 text-xs truncate">{platform.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            <div className="font-medium text-gray-900 dark:text-gray-100 text-xs">{platform.currency}</div>
                            <div className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{type}</div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            <div className="text-[10px] sm:text-[11px] text-gray-600 dark:text-gray-300 space-y-1">
                              {platform.token_rate && (
                                <div>Token: <span className="font-mono font-medium">{platform.token_rate}</span></div>
                              )}
                              {platform.discount_factor && (
                                <div>Desc: <span className="font-mono font-medium">{(platform.discount_factor * 100).toFixed(1)}%</span></div>
                              )}
                              {platform.tax_rate && (
                                <div>Imp: <span className="font-mono font-medium">{(platform.tax_rate * 100).toFixed(1)}%</span></div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center">
                            <span className={`w-[80px] flex items-center justify-center mx-auto px-3 pt-[6px] pb-[4px] rounded-full text-[11px] font-semibold capitalize border whitespace-nowrap ${
                              platform.payment_frequency === 'quincenal' 
                                ? 'bg-emerald-50/50 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-400/50 dark:shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                                : 'bg-purple-50/50 text-purple-700 border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-400/50 dark:shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                            }`}>
                              {platform.payment_frequency}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-2 text-center pr-6">
                            <div className="flex justify-center space-x-1 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                onClick={() => router.push(`/admin/calculator/platforms/${platform.id}/edit`)}
                                className="w-[75px] flex items-center justify-center px-3 pt-[6px] pb-[4px] rounded-full text-[11px] font-semibold border bg-transparent transition-all duration-300 text-cyan-600 border-cyan-500/60 hover:bg-cyan-50/80 hover:border-cyan-500 dark:text-cyan-400 dark:border-cyan-400/50 dark:hover:bg-cyan-500/20 dark:hover:border-cyan-300 dark:hover:shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(platform.id, platform.name)}
                                disabled={deletingId === platform.id}
                                className={`w-[75px] flex items-center justify-center px-3 pt-[6px] pb-[4px] rounded-full text-[11px] font-semibold border bg-transparent transition-all duration-300 ${
                                  deletingId === platform.id
                                    ? 'opacity-50 cursor-not-allowed text-gray-400 border-gray-300 dark:text-gray-600 dark:border-gray-700'
                                    : 'text-rose-600 border-rose-500/60 hover:bg-rose-50/80 hover:border-rose-500 dark:text-rose-400 dark:border-rose-400/50 dark:hover:bg-rose-500/20 dark:hover:border-rose-300 dark:hover:shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                                }`}
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
  );
}
