'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function UnfreezePlatformsPage() {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        return null;
      }
      const expiresAt = session.expires_at;
      if (expiresAt && (expiresAt - Math.floor(Date.now() / 1000) < 60)) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          return session.access_token;
        }
        return refreshedSession.access_token;
      }
      return session.access_token;
    } catch (error) {
      return null;
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    setStatus(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      const response = await fetch('/api/admin/unfreeze-platforms', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Error ${response.status}` };
        }
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setVerifying(false);
    }
  };

  const handleUnfreezeAll = async () => {
    if (!confirm('⚠️ ¿Estás seguro de que quieres descongelar TODAS las plataformas especiales de TODOS los modelos?\n\nEsto eliminará todos los registros de congelamiento.')) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      const response = await fetch('/api/admin/unfreeze-platforms?all=true', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Error ${response.status}` };
        }
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
      // Refrescar estado después de descongelar
      setTimeout(() => {
        handleVerify();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              🔓 Descongelar Plataformas Especiales
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Descongela las plataformas especiales que están bloqueadas en &quot;Mi Calculadora&quot;
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">ℹ️ Información:</h2>
            <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>Las plataformas especiales se congelan automáticamente en días de cierre de período</li>
              <li>Este proceso elimina los registros de congelamiento de la base de datos</li>
              <li>Las plataformas quedarán disponibles inmediatamente después de descongelar</li>
            </ul>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying || loading}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {verifying ? '⏳ Verificando...' : '🔍 Verificar Estado'}
            </button>
            <button
              onClick={handleUnfreezeAll}
              disabled={loading || verifying}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Descongelando...' : '🔓 Descongelar Todas las Plataformas'}
            </button>
          </div>

          {status && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">📊 Estado Actual:</h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <p><strong>Total de registros congelados:</strong> {status.total_records || 0}</p>
                <p><strong>Modelos afectados:</strong> {status.total_models || 0}</p>
                
                {status.summary && status.summary.length > 0 && (
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Modelos con plataformas congeladas:</p>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {status.summary.map((item: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-gray-700 p-3 rounded border border-blue-200 dark:border-blue-700">
                          <p className="font-medium">{item.email}</p>
                          <p className="text-xs opacity-75 mt-1">
                            {item.frozen_count} plataforma(s) congelada(s): {item.platforms.join(', ')}
                          </p>
                          <p className="text-xs opacity-60 mt-1">
                            Períodos: {item.periods.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {status.total_records === 0 && (
                  <p className="text-green-700 dark:text-green-300 font-semibold">
                    ✅ No hay plataformas congeladas
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Error:</h3>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Resultado:</h3>
              <p className="text-green-700 dark:text-green-300">
                {result.message || `Se descongelaron ${result.deleted_count || 0} plataforma(s)`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

