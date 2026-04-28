'use client';

import { useState } from 'react';

export default function SyncPortfolioPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/sync-existing-portfolio', {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-24">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🔄 Sincronizar Portafolio de Modelos
            </h1>
            <p className="text-gray-600 mb-8">
              Esta herramienta sincroniza automáticamente el Portafolio de modelos que ya tienen 
              configuración de calculadora pero no tienen Portafolio creado.
            </p>

            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">¿Qué hace esta sincronización?</h3>
                <ul className="text-blue-800 space-y-1 text-sm">
                  <li>• Busca modelos con configuración de calculadora activa</li>
                  <li>• Verifica cuáles NO tienen Portafolio</li>
                  <li>• Crea automáticamente el Portafolio con las plataformas habilitadas</li>
                  <li>• Marca las plataformas como &quot;entregada&quot; (verde)</li>
                  <li>• Marca como configuración inicial</li>
                </ul>
              </div>

              <button
                onClick={handleSync}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Ejecutar Sincronización</span>
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
                  <h3 className="font-semibold text-green-900 mb-2">✅ Resultado</h3>
                  <p className="text-green-800 text-sm mb-4">{result.message}</p>
                  
                  {result.results && result.results.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-900">Detalles por modelo:</h4>
                      <div className="space-y-1">
                        {result.results.map((r: any, index: number) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            {r.success ? (
                              <>
                                <span className="text-green-600">✅</span>
                                <span className="text-green-800">
                                  {r.email}: {r.platforms} plataformas sincronizadas
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-red-600">❌</span>
                                <span className="text-red-800">
                                  {r.email}: {r.error}
                                </span>
                              </>
                            )}
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
