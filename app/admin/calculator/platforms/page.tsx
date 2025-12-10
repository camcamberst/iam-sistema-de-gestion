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
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && !platforms.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              Gestión de Plataformas
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Administra las plataformas disponibles en la calculadora
            </p>
          </div>
          
          <Link
            href="/admin/calculator/create-platform"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Plataforma
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Tabla de Plataformas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Plataforma</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo / Moneda</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Configuración</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Frecuencia</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {platforms.map((platform) => {
                  // Determinar tipo
                  let type = 'Estándar';
                  if (platform.token_rate) type = 'Tokens';
                  else if (platform.direct_payout) type = 'Pago Directo';
                  
                  return (
                    <tr key={platform.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                            {platform.name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900 dark:text-white">{platform.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono text-xs">{platform.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{platform.currency}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
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
                      <td className="px-6 py-4">
                         <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                           platform.payment_frequency === 'quincenal' 
                             ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                             : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                         }`}>
                           {platform.payment_frequency}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <Link
                          href={`/admin/calculator/platforms/${platform.id}/edit`}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(platform.id, platform.name)}
                          disabled={deletingId === platform.id}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm disabled:opacity-50"
                        >
                          {deletingId === platform.id ? '...' : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {platforms.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No hay plataformas activas.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

