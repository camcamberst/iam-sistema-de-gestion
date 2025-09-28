// =====================================================
// 🔍 DEBUG AVANZADO PARA API ROUTES
// =====================================================

// Función para interceptar y debuggear todas las llamadas a la API
function debugAPI() {
    console.log('🔍 [DEBUG] Iniciando sistema de debug avanzado...');
    
    // Interceptar fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options] = args;
        
        console.log('🌐 [DEBUG-API] Llamada a:', url);
        console.log('🌐 [DEBUG-API] Opciones:', options);
        console.log('🌐 [DEBUG-API] Timestamp:', new Date().toISOString());
        
        try {
            const response = await originalFetch.apply(this, args);
            
            console.log('✅ [DEBUG-API] Respuesta recibida:', {
                url: url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            // Clonar la respuesta para poder leer el body
            const responseClone = response.clone();
            
            try {
                const responseData = await responseClone.json();
                console.log('📄 [DEBUG-API] Datos de respuesta:', responseData);
            } catch (e) {
                console.log('📄 [DEBUG-API] Respuesta no es JSON:', await responseClone.text());
            }
            
            return response;
        } catch (error) {
            console.error('❌ [DEBUG-API] Error en llamada:', {
                url: url,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    };
    
    console.log('✅ [DEBUG] Sistema de debug instalado correctamente');
}

// Función para debuggear el estado de autenticación
function debugAuth() {
    console.log('🔐 [DEBUG-AUTH] Verificando estado de autenticación...');
    
    // Verificar si hay token en localStorage
    const token = localStorage.getItem('sb-access-token') || localStorage.getItem('supabase.auth.token');
    console.log('🔐 [DEBUG-AUTH] Token encontrado:', token ? 'Sí' : 'No');
    
    // Verificar cookies
    const cookies = document.cookie;
    console.log('🍪 [DEBUG-AUTH] Cookies:', cookies);
    
    // Verificar sessionStorage
    const sessionData = sessionStorage.getItem('supabase.auth.session');
    console.log('💾 [DEBUG-AUTH] Session data:', sessionData ? 'Sí' : 'No');
    
    if (sessionData) {
        try {
            const parsed = JSON.parse(sessionData);
            console.log('💾 [DEBUG-AUTH] Session parsed:', parsed);
        } catch (e) {
            console.log('💾 [DEBUG-AUTH] Error parsing session:', e);
        }
    }
}

// Función para debuggear el estado de la base de datos
async function debugDatabase() {
    console.log('🗄️ [DEBUG-DB] Verificando conexión a base de datos...');
    
    try {
        // Intentar hacer una llamada simple a la API
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        console.log('🗄️ [DEBUG-DB] Respuesta de /api/users:', {
            status: response.status,
            statusText: response.statusText
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('🗄️ [DEBUG-DB] Error en /api/users:', errorText);
        }
        
    } catch (error) {
        console.error('🗄️ [DEBUG-DB] Error de conexión:', error);
    }
}

// Función para debuggear el estado de la aplicación
function debugAppState() {
    console.log('📱 [DEBUG-APP] Estado de la aplicación:');
    
    // Verificar si estamos en la página correcta
    const currentPath = window.location.pathname;
    console.log('📍 [DEBUG-APP] Ruta actual:', currentPath);
    
    // Verificar elementos del DOM
    const userManagementSection = document.querySelector('[data-testid="user-management"]') || 
                                 document.querySelector('.user-management') ||
                                 document.querySelector('h1');
    console.log('🎯 [DEBUG-APP] Sección de gestión encontrada:', userManagementSection ? 'Sí' : 'No');
    
    // Verificar si hay errores en el DOM
    const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
    console.log('❌ [DEBUG-APP] Elementos de error encontrados:', errorElements.length);
    
    errorElements.forEach((el, index) => {
        console.log(`❌ [DEBUG-APP] Error ${index + 1}:`, el.textContent);
    });
}

// Función principal de debug
function startDebug() {
    console.log('🚀 [DEBUG] Iniciando debug completo...');
    console.log('🚀 [DEBUG] ===========================================');
    
    debugAuth();
    debugAppState();
    debugAPI();
    
    // Esperar un poco y luego debuggear la base de datos
    setTimeout(() => {
        debugDatabase();
    }, 1000);
    
    console.log('🚀 [DEBUG] ===========================================');
    console.log('🚀 [DEBUG] Debug completo iniciado. Revisa la consola para detalles.');
}

// Auto-iniciar debug cuando se carga la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startDebug);
} else {
    startDebug();
}

// Exportar funciones para uso manual
window.debugAPI = debugAPI;
window.debugAuth = debugAuth;
window.debugDatabase = debugDatabase;
window.debugAppState = debugAppState;
window.startDebug = startDebug;
