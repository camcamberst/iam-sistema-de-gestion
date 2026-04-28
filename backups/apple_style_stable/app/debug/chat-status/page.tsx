'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChatStatusDiagnostic() {
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    try {
      setLoading(true);
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Iniciando diagnóstico...');
      
      // 1. Obtener sesión actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Sesión:', session);
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Error sesión:', sessionError);
      
      if (!session) {
        setDiagnosticData({
          error: 'No hay sesión activa',
          session: null
        });
        return;
      }
      
      // 2. Obtener información del usuario actual
      const { data: currentUser, error: userError } = await supabase
        .from('users')
        .select('id, email, name, role, is_active, last_login')
        .eq('id', session.user.id)
        .single();
      
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Usuario actual:', currentUser);
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Error usuario:', userError);
      
      // 3. Obtener estado de chat del usuario actual
      const { data: chatStatus, error: statusError } = await supabase
        .from('chat_user_status')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Estado de chat:', chatStatus);
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Error estado:', statusError);
      
      // 4. Obtener todos los estados de chat
      const { data: allChatStatuses, error: allStatusError } = await supabase
        .from('chat_user_status')
        .select(`
          user_id,
          is_online,
          last_seen,
          updated_at,
          users!inner(
            id,
            email,
            name,
            role
          )
        `)
        .order('updated_at', { ascending: false });
      
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Todos los estados:', allChatStatuses);
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Error todos los estados:', allStatusError);
      
      // 5. Probar actualización de estado
      const testUpdate = async () => {
        try {
          const { data: updateResult, error: updateError } = await supabase
            .from('chat_user_status')
            .upsert({
              user_id: session.user.id,
              is_online: true,
              last_seen: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select();
          
          console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Resultado actualización:', updateResult);
          console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Error actualización:', updateError);
          
          return { updateResult, updateError };
        } catch (error) {
          console.error('🔍 [CHAT-STATUS-DIAGNOSTIC] Error en actualización:', error);
          return { updateResult: null, updateError: error };
        }
      };
      
      const updateTest = await testUpdate();
      
      // 6. Verificar después de la actualización
      const { data: chatStatusAfter, error: statusAfterError } = await supabase
        .from('chat_user_status')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      console.log('🔍 [CHAT-STATUS-DIAGNOSTIC] Estado después de actualización:', chatStatusAfter);
      
      setDiagnosticData({
        session: {
          user: session.user,
          access_token: session.access_token ? 'Presente' : 'Ausente'
        },
        currentUser,
        userError,
        chatStatus,
        statusError,
        allChatStatuses,
        allStatusError,
        updateTest,
        chatStatusAfter,
        statusAfterError,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ [CHAT-STATUS-DIAGNOSTIC] Error general:', error);
      setDiagnosticData({
        error: (error as any)?.message || 'Error desconocido',
        timestamp: new Date().toISOString()
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
            🔍 Diagnóstico de Estado de Chat
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Analiza el estado online/offline de usuarios en el sistema de chat
          </p>
          
          <button
            onClick={runDiagnostic}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Ejecutando diagnóstico...' : 'Ejecutar Diagnóstico'}
          </button>
        </div>

        {diagnosticData && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              📊 Resultados del Diagnóstico
            </h2>
            
            <div className="space-y-6">
              {/* Sesión */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🔐 Sesión</h3>
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(diagnosticData.session, null, 2)}
                </pre>
              </div>
              
              {/* Usuario Actual */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">👤 Usuario Actual</h3>
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(diagnosticData.currentUser, null, 2)}
                </pre>
                {diagnosticData.userError && (
                  <div className="mt-2 text-red-600 dark:text-red-400">
                    Error: {JSON.stringify(diagnosticData.userError, null, 2)}
                  </div>
                )}
              </div>
              
              {/* Estado de Chat */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">💬 Estado de Chat</h3>
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(diagnosticData.chatStatus, null, 2)}
                </pre>
                {diagnosticData.statusError && (
                  <div className="mt-2 text-red-600 dark:text-red-400">
                    Error: {JSON.stringify(diagnosticData.statusError, null, 2)}
                  </div>
                )}
              </div>
              
              {/* Todos los Estados */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">👥 Todos los Estados de Chat</h3>
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(diagnosticData.allChatStatuses, null, 2)}
                </pre>
                {diagnosticData.allStatusError && (
                  <div className="mt-2 text-red-600 dark:text-red-400">
                    Error: {JSON.stringify(diagnosticData.allStatusError, null, 2)}
                  </div>
                )}
              </div>
              
              {/* Prueba de Actualización */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🔄 Prueba de Actualización</h3>
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(diagnosticData.updateTest, null, 2)}
                </pre>
              </div>
              
              {/* Estado Después de Actualización */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">✅ Estado Después de Actualización</h3>
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(diagnosticData.chatStatusAfter, null, 2)}
                </pre>
              </div>
              
              {/* Error General */}
              {diagnosticData.error && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">❌ Error General</h3>
                  <p className="text-red-700 dark:text-red-300">{diagnosticData.error}</p>
                </div>
              )}
              
              {/* Timestamp */}
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Diagnóstico ejecutado: {diagnosticData.timestamp}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
