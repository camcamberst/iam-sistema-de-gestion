'use client';

import { useState } from 'react';

export default function AutoCleanupTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runCleanup = async () => {
    try {
      setLoading(true);
      console.log('🧹 [AUTO-CLEANUP-TEST] Ejecutando limpieza automática...');
      
      const response = await fetch('/api/chat/auto-cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('🧹 [AUTO-CLEANUP-TEST] Resultado:', data);
      
      setResult(data);
      
    } catch (error) {
      console.error('❌ [AUTO-CLEANUP-TEST] Error:', error);
      setResult({
        error: (error as any)?.message || 'Error desconocido'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStats = async () => {
    try {
      setLoading(true);
      console.log('📊 [AUTO-CLEANUP-TEST] Obteniendo estadísticas...');
      
      const response = await fetch('/api/chat/auto-cleanup', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('📊 [AUTO-CLEANUP-TEST] Estadísticas:', data);
      
      setResult(data);
      
    } catch (error) {
      console.error('❌ [AUTO-CLEANUP-TEST] Error:', error);
      setResult({
        error: (error as any)?.message || 'Error desconocido'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            🧹 Limpieza Automática de Usuarios Inactivos
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Herramienta para probar la limpieza automática de usuarios que no han enviado heartbeat en los últimos 2 minutos
          </p>
          
          <div className="flex space-x-4">
            <button
              onClick={runCleanup}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Ejecutando...' : 'Ejecutar Limpieza'}
            </button>
            
            <button
              onClick={getStats}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Obteniendo...' : 'Ver Estadísticas'}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 Resultados
            </h2>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
            
            {result.success && result.stats && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {result.stats.total}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Usuarios</div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.stats.online}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">En Línea</div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {result.stats.offline}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Offline</div>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {result.stats.potentiallyInactive}
                  </div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">Potencialmente Inactivos</div>
                </div>
              </div>
            )}
            
            {result.success && result.cleanedCount > 0 && (
              <div className="mt-6 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  ✅ Usuarios Limpiados
                </h3>
                <p className="text-green-700 dark:text-green-300">
                  Se marcaron como offline {result.cleanedCount} usuarios inactivos
                </p>
                {result.cleanedUsers && (
                  <div className="mt-2">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      IDs: {result.cleanedUsers.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {result.error && (
              <div className="mt-6 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                  ❌ Error
                </h3>
                <p className="text-red-700 dark:text-red-300">{result.error}</p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            ℹ️ Información
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• La limpieza marca como offline usuarios que no han enviado heartbeat en 2+ minutos</li>
            <li>• Los usuarios se marcan automáticamente como online al hacer login</li>
            <li>• El heartbeat se envía cada 30 segundos cuando la pestaña está activa</li>
            <li>• Se detecta pérdida de conexión a internet automáticamente</li>
            <li>• Al cerrar la pestaña/navegador se marca como offline</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
