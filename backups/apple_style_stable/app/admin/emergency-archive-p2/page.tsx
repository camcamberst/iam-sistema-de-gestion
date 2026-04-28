'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function EmergencyArchiveP2Page() {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const getAuthToken = async (): Promise<string | null> => {
    try {
      // Primero intentar obtener la sesión actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error obteniendo sesión:', sessionError);
        return null;
      }

      if (!session) {
        console.error('No hay sesión activa');
        return null;
      }

      // Verificar si el token está cerca de expirar (menos de 60 segundos)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = expiresAt - now;
        
        if (expiresIn < 60) {
          // Refrescar el token si está cerca de expirar
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('Error refrescando sesión:', refreshError);
            return session.access_token; // Usar el token actual aunque esté cerca de expirar
          }
          
          if (refreshedSession) {
            return refreshedSession.access_token;
          }
        }
      }
      
      return session.access_token;
    } catch (error) {
      console.error('Error obteniendo token:', error);
      return null;
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    setVerification(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      console.log('🔍 Verificando estado...');
      const response = await fetch('/api/admin/emergency-archive-p2/verify', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Respuesta status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Error ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Error en respuesta:', errorData);
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Verificación exitosa:', data);
      setVerification(data);
    } catch (err: any) {
      console.error('❌ Error en handleVerify:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async (force: boolean = false) => {
    const mensaje = force 
      ? '🔥 ¿Estás seguro de que quieres FORZAR la eliminación de TODOS los valores de P2 de diciembre?\n\n⚠️ PELIGRO: Esto eliminará valores INCLUSO si NO están archivados.\n\nSolo usa esto si estás seguro de que los valores ya fueron archivados o si necesitas resetear las calculadoras a "0".'
      : '⚠️ ¿Estás seguro de que quieres eliminar los valores de P2 de diciembre de "Mi Calculadora"?\n\nEsto eliminará los valores de model_values SOLO si están archivados en calculator_history.\n\nLos valores archivados en "Mi Historial" NO se verán afectados.';
    
    if (!confirm(mensaje)) {
      return;
    }

    setDeleting(true);
    setError(null);
    setResult(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      console.log('🗑️ Eliminando valores...');
      console.log('🔐 Token obtenido:', token.substring(0, 20) + '...');
      
      // Construir URL con parámetro force si es necesario
      const url = force 
        ? '/api/admin/emergency-archive-p2/delete?force=true'
        : '/api/admin/emergency-archive-p2/delete';
      
      // Intentar primero con DELETE, si falla intentar con POST
      let response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Si DELETE falla con 405 (Method Not Allowed), intentar con POST
      if (response.status === 405) {
        console.log('⚠️ DELETE no permitido, intentando con POST...');
        response = await fetch(force 
          ? '/api/admin/emergency-archive-p2/delete?force=true'
          : '/api/admin/emergency-archive-p2/delete', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: force ? JSON.stringify({ force: true }) : undefined
        });
      }

      console.log('📡 Respuesta status:', response.status);
      console.log('📡 Respuesta headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('📡 Respuesta body (raw):', responseText.substring(0, 500));

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || `Error ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Error en respuesta:', errorData);
        throw new Error(errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('Respuesta no válida del servidor');
      }
      
      console.log('✅ Eliminación exitosa:', data);
      setResult(data);
      
      // Refrescar verificación después de eliminar
      setTimeout(() => {
        handleVerify();
      }, 1000);
    } catch (err: any) {
      console.error('❌ Error en handleDelete:', err);
      const errorMessage = err.message || err.toString() || 'Error desconocido';
      setError(errorMessage);
      console.error('❌ Stack trace:', err.stack);
    } finally {
      setDeleting(false);
    }
  };

  const handleClean = async () => {
    if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar los registros archivados del período P2 de diciembre?\n\nEsto permitirá volver a archivar con los valores correctos.')) {
      return;
    }

    setCleaning(true);
    setError(null);
    setResult(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      console.log('🧹 Limpiando registros incorrectos...');
      const response = await fetch('/api/admin/emergency-archive-p2/clean', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Respuesta status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Error ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Error en respuesta:', errorData);
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Limpieza exitosa:', data);
      setResult(data);
      
      // Refrescar verificación después de limpiar
      setTimeout(() => {
        handleVerify();
      }, 1000);
    } catch (err: any) {
      console.error('❌ Error en handleClean:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setCleaning(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('¿Estás seguro de que quieres archivar el período 16-31 de diciembre?\n\nEsto archivará los valores en calculator_history pero NO eliminará los valores de model_values.')) {
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

      console.log('🚀 Iniciando archivado...');
      const response = await fetch('/api/admin/emergency-archive-p2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Respuesta status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Error ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Error en respuesta:', errorData);
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Archivado exitoso:', data);
      setResult(data);
      
      // Refrescar verificación después de archivar
      setTimeout(() => {
        handleVerify();
      }, 1000);
    } catch (err: any) {
      console.error('❌ Error en handleArchive:', err);
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
              🚨 Archivado de Emergencia: P2 de Diciembre 2025
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Archiva los valores por plataforma del período 16-31 de diciembre en calculator_history
            </p>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ IMPORTANTE:</h2>
            <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>Este proceso SOLO archiva, NO elimina valores de model_values</li>
              <li>Los valores se mantienen en model_values para verificación</li>
              <li>Solo archiva valores hasta las 23:59:59 del 31 de diciembre</li>
              <li>Una vez verificado, puedes eliminar los valores residuales manualmente</li>
            </ul>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleVerify}
              disabled={verifying || loading || cleaning || deleting}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed active:scale-95 touch-manipulation"
            >
              {verifying ? '⏳ Verificando...' : '🔍 Verificar Estado'}
            </button>
            <button
              onClick={handleClean}
              disabled={loading || verifying || cleaning || deleting}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed active:scale-95 touch-manipulation"
            >
              {cleaning ? '⏳ Limpiando...' : '🧹 Limpiar Registros Incorrectos'}
            </button>
            <button
              onClick={handleArchive}
              disabled={loading || verifying || cleaning || deleting}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed active:scale-95 touch-manipulation"
            >
              {loading ? '⏳ Archivando...' : '🚀 Archivar P2 de Diciembre'}
            </button>
            <button
              onClick={() => handleDelete(false)}
              disabled={loading || verifying || cleaning || deleting}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed active:scale-95 touch-manipulation"
            >
              {deleting ? '⏳ Eliminando...' : '🗑️ Eliminar Valores de Mi Calculadora'}
            </button>
            <button
              onClick={() => handleDelete(true)}
              disabled={loading || verifying || cleaning || deleting}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed active:scale-95 touch-manipulation"
            >
              {deleting ? '⏳ Eliminando...' : '🔥 Forzar Eliminación (Sin Verificar Archivo)'}
            </button>
          </div>

          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">🔄 Reset Completo de Calculadora:</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
              <strong>⚠️ PELIGRO:</strong> Esto eliminará TODOS los valores y totales de la calculadora, sin importar el período. 
              Úsalo solo si necesitas resetear completamente una calculadora a cero.
            </p>
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="ID del modelo (UUID) - Dejar vacío para resetear TODOS"
                  id="reset-model-id"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={async () => {
                    const modelId = (document.getElementById('reset-model-id') as HTMLInputElement)?.value.trim();
                    const resetAll = !modelId;
                    
                    const mensaje = resetAll
                      ? '🔥 ¿Estás seguro de que quieres RESETEAR COMPLETAMENTE TODAS las calculadoras?\n\n⚠️ PELIGRO EXTREMO: Esto eliminará TODOS los valores y totales de TODAS las calculadoras, sin importar el período.\n\nEsta acción NO se puede deshacer.'
                      : `🔥 ¿Estás seguro de que quieres RESETEAR COMPLETAMENTE esta calculadora?\n\n⚠️ PELIGRO: Esto eliminará TODOS los valores y totales de esta calculadora, sin importar el período.\n\nEsta acción NO se puede deshacer.`;
                    
                    if (!confirm(mensaje)) {
                      return;
                    }

                    setDeleting(true);
                    setError(null);
                    setResult(null);

                    try {
                      const token = await getAuthToken();
                      if (!token) {
                        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
                      }

                      console.log('🔄 Reseteando calculadora(s)...');
                      const response = await fetch('/api/admin/emergency-archive-p2/reset-calculator', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          modelId: modelId || null,
                          resetAll: resetAll
                        })
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
                      console.log('✅ Reset completado:', data);
                      
                      // Refrescar verificación después de resetear
                      setTimeout(() => {
                        handleVerify();
                      }, 1000);
                    } catch (err: any) {
                      setError(err.message || 'Error desconocido');
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={loading || verifying || cleaning || deleting}
                  className="w-full px-4 py-2 bg-red-700 hover:bg-red-800 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {deleting ? '⏳ Reseteando...' : '🔄 Resetear Calculadora(s) a Cero'}
                </button>
              </div>
            </div>
          </div>

          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">🔍 Diagnóstico:</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              Si las calculadoras no quedan en cero después de eliminar, usa estas herramientas para diagnosticar el problema.
            </p>
            <div className="space-y-3">
              <div>
                <button
                  onClick={async () => {
                    try {
                      const token = await getAuthToken();
                      if (!token) {
                        throw new Error('No hay sesión activa');
                      }
                      const response = await fetch('/api/admin/emergency-archive-p2/list-models-with-values?period=p2-december', {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const data = await response.json();
                      console.log('📋 Modelos con valores P2:', data);
                      if (data.success && data.models) {
                        alert(`Se encontraron ${data.models.length} modelo(s) con valores en P2 de diciembre.\n\nRevisa la consola del navegador para ver los detalles completos.`);
                      } else {
                        alert('No se encontraron modelos con valores o hubo un error.');
                      }
                    } catch (err: any) {
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg mb-2"
                >
                  📋 Listar Modelos con Valores (P2 Diciembre)
                </button>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="ID del modelo (UUID) para diagnóstico detallado"
                  id="diagnose-model-id"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={async () => {
                    const modelId = (document.getElementById('diagnose-model-id') as HTMLInputElement)?.value;
                    if (!modelId) {
                      alert('Por favor ingresa un ID de modelo');
                      return;
                    }
                    try {
                      const token = await getAuthToken();
                      if (!token) {
                        throw new Error('No hay sesión activa');
                      }
                      const response = await fetch(`/api/admin/emergency-archive-p2/diagnose?modelId=${modelId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const data = await response.json();
                      console.log('🔍 Diagnóstico detallado:', data);
                      alert(`Diagnóstico completado. Revisa la consola del navegador para ver los detalles.\n\nResumen:\n- Total valores (todos períodos): ${data.diagnostic?.summary?.total_values_all_periods || 0}\n- Valores P2 (todos): ${data.diagnostic?.summary?.p2_values_total || 0}\n- Valores P2 después del límite: ${data.diagnostic?.summary?.p2_values_after_limit || 0}\n- Total totales: ${data.diagnostic?.all_totals?.total || 0}`);
                    } catch (err: any) {
                      alert(`Error: ${err.message}`);
                    }
                  }}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                >
                  🔍 Diagnosticar Modelo Específico
                </button>
              </div>
            </div>
          </div>

          {verification && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">📊 Estado Actual:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>Registros en calculator_history:</strong> {verification.resumen?.registros_en_history || 0}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>Modelos archivados:</strong> {verification.resumen?.modelos_en_history || 0}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>Valores en model_values:</strong> {verification.resumen?.registros_en_model_values || 0}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>Modelos con valores:</strong> {verification.resumen?.modelos_en_model_values || 0}
                  </p>
                </div>
              </div>
              {verification.resumen?.modelos_solo_en_model_values > 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <p className="text-amber-700 dark:text-amber-300 font-semibold">
                    ⚠️ {verification.resumen.modelos_solo_en_model_values} modelo(s) necesitan archivado
                  </p>
                  {verification.detalles && verification.detalles.filter((d: any) => d.necesita_archivado).length > 0 && (
                    <ul className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1 max-h-40 overflow-y-auto">
                      {verification.detalles.filter((d: any) => d.necesita_archivado).slice(0, 10).map((d: any, idx: number) => (
                        <li key={idx}>• {d.email}: {d.plataformas_en_model_values} plataforma(s)</li>
                      ))}
                      {verification.detalles.filter((d: any) => d.necesita_archivado).length > 10 && (
                        <li>... y {verification.detalles.filter((d: any) => d.necesita_archivado).length - 10} más</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
              {verification.resumen?.registros_en_history === 0 && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <p className="text-amber-700 dark:text-amber-300 font-semibold">
                    ⚠️ No hay registros archivados. Ejecuta el archivado para crear el historial.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Error:</h3>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Resultado:</h3>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  {result.mensaje && (
                    <p className="font-semibold text-base mb-2">{result.mensaje}</p>
                  )}
                  {result.resumen && (
                    <>
                      <p><strong>Total modelos procesados:</strong> {result.resumen.total_modelos || 0}</p>
                      <p><strong>✅ Exitosos:</strong> {result.resumen.exitosos || 0}</p>
                      <p><strong>❌ Errores:</strong> {result.resumen.errores || 0}</p>
                      {result.resumen.total_eliminados !== undefined && (
                        <p><strong>🗑️ Valores eliminados:</strong> {result.resumen.total_eliminados || 0}</p>
                      )}
                      {result.resumen.total_archivados !== undefined && (
                        <p><strong>📦 Registros archivados:</strong> {result.resumen.total_archivados || 0}</p>
                      )}
                      {result.resumen.modelos_omitidos !== undefined && result.resumen.modelos_omitidos > 0 && (
                        <p><strong>⏭️ Modelos omitidos (sin archivo):</strong> {result.resumen.modelos_omitidos || 0}</p>
                      )}
                      {result.resumen.modelos_sin_archivo !== undefined && (
                        <p><strong>⚠️ Modelos sin archivo:</strong> {result.resumen.modelos_sin_archivo || 0}</p>
                      )}
                      {result.resumen.residuales_restantes !== undefined && (
                        <p><strong>🔍 Valores residuales restantes:</strong> {result.resumen.residuales_restantes || 0}</p>
                      )}
                    </>
                  )}
                  {result.eliminados !== undefined && (
                    <p><strong>🗑️ Total eliminados:</strong> {result.eliminados}</p>
                  )}
                </div>
              </div>

              {result.resultados && result.resultados.length > 0 && (
                <>
                  {result.resultados.filter((r: any) => !r.tiene_archivo).length > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⏭️ Modelos omitidos (sin archivo) ({result.resultados.filter((r: any) => !r.tiene_archivo).length}):</h3>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2 max-h-60 overflow-y-auto">
                        {result.resultados.filter((r: any) => !r.tiene_archivo).map((r: any, idx: number) => (
                          <div key={idx} className="border-b border-yellow-200 dark:border-yellow-700 pb-2 last:border-0">
                            <p className="font-semibold">{r.email}</p>
                            <p className="text-xs opacity-90 mt-1">⏭️ Omitido: No tiene archivo en calculator_history</p>
                            {r.valores_en_model_values !== undefined && r.valores_en_model_values > 0 && (
                              <p className="text-xs opacity-75 mt-1">📊 Valores en model_values: {r.valores_en_model_values} (no eliminados por seguridad)</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          💡 Estos modelos fueron omitidos por seguridad. Si necesitas eliminar sus valores, primero archívalos con &quot;🚀 Archivar P2 de Diciembre&quot;.
                        </p>
                      </div>
                    </div>
                  )}

                  {result.resultados.filter((r: any) => r.tiene_archivo && r.error).length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Modelos con errores ({result.resultados.filter((r: any) => r.tiene_archivo && r.error).length}):</h3>
                      <div className="text-sm text-red-700 dark:text-red-300 space-y-2 max-h-60 overflow-y-auto">
                        {result.resultados.filter((r: any) => r.tiene_archivo && r.error).map((r: any, idx: number) => (
                          <div key={idx} className="border-b border-red-200 dark:border-red-700 pb-2 last:border-0">
                            <p className="font-semibold">{r.email}</p>
                            <p className="text-xs opacity-90 mt-1 break-words">{r.error}</p>
                            {r.plataformas > 0 && (
                              <p className="text-xs opacity-75 mt-1">Plataformas: {r.plataformas}</p>
                            )}
                            {r.registros_archivados !== undefined && r.registros_archivados > 0 && (
                              <p className="text-xs opacity-75 mt-1">Registros archivados: {r.registros_archivados}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.resultados.filter((r: any) => !r.error && r.valores_eliminados > 0).length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">✅ Modelos con valores eliminados exitosamente:</h3>
                      <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2 max-h-60 overflow-y-auto">
                        {result.resultados.filter((r: any) => !r.error && r.valores_eliminados > 0).map((r: any, idx: number) => (
                          <div key={idx} className="border-b border-blue-200 dark:border-blue-700 pb-2 last:border-0">
                            <p className="font-semibold">{r.email}</p>
                            <p className="text-xs opacity-90 mt-1">
                              ✅ {r.valores_eliminados} valor(es) eliminado(s)
                              {r.registros_archivados > 0 && ` • ${r.registros_archivados} registro(s) archivado(s)`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}


              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">📋 Próximos pasos:</h3>
                <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Verificar en &quot;Mi Historial&quot; que los datos se muestran correctamente</li>
                  <li>Verificar en calculator_history que los registros están completos</li>
                  <li>Una vez verificado, puedes eliminar los valores residuales de model_values si lo deseas</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

