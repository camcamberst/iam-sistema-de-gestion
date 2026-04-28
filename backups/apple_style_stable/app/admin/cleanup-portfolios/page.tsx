'use client';

import { useState } from 'react';

export default function CleanupPortfoliosPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/cleanup-incorrect-portfolios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Error desconocido');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 pt-24">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🧹 Limpiar Portafolios Incorrectos
            </h1>
            <p className="text-gray-600 mb-8">
              Esta herramienta elimina los portafolios que se crearon incorrectamente 
              durante la sincronización automática, que heredó el mismo portafolio a todas las modelos.
            </p>

            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">⚠️ ¿Qué hace esta limpieza?</h3>
                <ul className="text-red-800 space-y-1 text-sm">
                  <li>• Busca portafolios creados con "Sincronización automática de configuración existente"</li>
                  <li>• Los elimina completamente de la base de datos</li>
                  <li>• Permite que cada modelo configure su calculadora individualmente</li>
                  <li>• Restaura el estado original antes de la sincronización incorrecta</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Importante</h3>
                <p className="text-yellow-800 text-sm">
                  Esta acción es irreversible. Los portafolios eliminados tendrán que ser 
                  configurados nuevamente cuando cada modelo configure su calculadora por primera vez.
                </p>
              </div>

              <button
                onClick={handleCleanup}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Limpiando...</span>
                  </>
                ) : (
                  <>
                    <span>🧹</span>
                    <span>Ejecutar Limpieza</span>
                  </>
                )}
              </button>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-2">❌ Error</h3>
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">✅ Limpieza Completada</h3>
                  <p className="text-green-800 text-sm mb-4">{result.message}</p>
                  
                  {result.results && result.results.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-900">Portafolios eliminados por modelo:</h4>
                      <div className="space-y-1">
                        {result.results.map((r: any, index: number) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <span className="text-green-600">✅</span>
                            <span className="text-green-800">
                              {r.email}: {r.platforms_deleted} portafolios eliminados
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
