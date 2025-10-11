'use client';

import { useState } from 'react';

export default function CleanupAllDataPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/cleanup-all-model-data', {
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
              🧹 Limpieza Completa de Datos de Modelos
            </h1>
            <p className="text-gray-600 mb-8">
              Esta herramienta elimina COMPLETAMENTE todos los datos de TODAS las modelos, 
              excepto una específica, dejándolas listas para configuración inicial como si fueran modelos nuevas.
            </p>

            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">⚠️ ¿Qué hace esta limpieza completa?</h3>
                <ul className="text-red-800 space-y-1 text-sm">
                  <li>• <strong>Elimina TODOS los portafolios</strong> de las modelos objetivo</li>
                  <li>• <strong>Elimina TODAS las configuraciones de calculadora</strong> existentes</li>
                  <li>• <strong>Deja las cuentas completamente limpias</strong> como modelos nuevas</li>
                  <li>• <strong>Permite configuración inicial completa</strong> desde cero</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">🎯 Modelos Objetivo</h3>
                <ul className="text-blue-800 space-y-1 text-sm">
                  <li>• <strong>TODAS las modelos</strong> con rol 'modelo'</li>
                  <li>• <strong>EXCEPTO</strong> la modelo con ID: fe54995d-1828-4721-8153-53fce6f4fe56</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 mb-2">⚠️ Importante</h3>
                <p className="text-yellow-800 text-sm">
                  Esta acción es <strong>IRREVERSIBLE</strong>. Se eliminarán TODOS los datos de calculadora 
                  y portafolio de estas modelos. Tendrán que configurar todo desde cero como si fueran modelos nuevas.
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
                    <span>Ejecutar Limpieza Completa</span>
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
                  <h3 className="font-semibold text-green-900 mb-2">✅ Limpieza Completa Realizada</h3>
                  <p className="text-green-800 text-sm mb-4">{result.message}</p>
                  
                  {result.results && result.results.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-green-900">Modelos limpiadas:</h4>
                      <div className="space-y-1">
                        {result.results.map((r: any, index: number) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <span className="text-green-600">✅</span>
                            <span className="text-green-800">
                              {r.email}: {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 p-3 bg-green-100 rounded-lg">
                    <p className="text-green-800 text-sm font-medium">
                      🎉 Las modelos están ahora listas para configuración inicial completa
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
