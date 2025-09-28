// =====================================================
// 🔍 DEBUG SERVER-SIDE PARA API ROUTES
// =====================================================

// Función para agregar logs detallados a las API routes
function addServerDebug() {
    console.log('🔧 [DEBUG-SERVER] Agregando logs de debug a API routes...');
    
    // Este script se debe ejecutar en el servidor para agregar logs
    const debugCode = `
// =====================================================
// 🔍 DEBUG LOGS PARA API ROUTES
// =====================================================

// Función para loggear requests entrantes
function logRequest(method, url, headers, body) {
    console.log('📥 [API-DEBUG] Request recibido:', {
        method: method,
        url: url,
        headers: headers,
        body: body,
        timestamp: new Date().toISOString()
    });
}

// Función para loggear responses
function logResponse(status, data, error) {
    console.log('📤 [API-DEBUG] Response enviado:', {
        status: status,
        data: data,
        error: error,
        timestamp: new Date().toISOString()
    });
}

// Función para loggear errores de base de datos
function logDatabaseError(operation, error) {
    console.error('🗄️ [DB-DEBUG] Error en base de datos:', {
        operation: operation,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
}

// Función para loggear autenticación
function logAuth(authResult, requiredPermission) {
    console.log('🔐 [AUTH-DEBUG] Verificación de autenticación:', {
        success: 'user' in authResult,
        hasUser: !!authResult.user,
        userRole: authResult.user?.role,
        requiredPermission: requiredPermission,
        timestamp: new Date().toISOString()
    });
}
`;
    
    console.log('📝 [DEBUG-SERVER] Código de debug generado');
    return debugCode;
}

// Función para crear un script de test de API
function createAPITest() {
    const testCode = `
// =====================================================
// 🧪 TEST DE API ROUTES
// =====================================================

async function testAPI() {
    console.log('🧪 [API-TEST] Iniciando tests de API...');
    
    const tests = [
        {
            name: 'Test /api/users',
            url: '/api/users',
            method: 'GET'
        },
        {
            name: 'Test /api/groups',
            url: '/api/groups',
            method: 'GET'
        }
    ];
    
    for (const test of tests) {
        console.log(\`🧪 [API-TEST] Ejecutando: \${test.name}\`);
        
        try {
            const response = await fetch(test.url, {
                method: test.method,
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            console.log(\`✅ [API-TEST] \${test.name} - Status: \${response.status}\`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(\`❌ [API-TEST] \${test.name} - Error: \${errorText}\`);
            } else {
                const data = await response.json();
                console.log(\`📄 [API-TEST] \${test.name} - Data: \`, data);
            }
            
        } catch (error) {
            console.error(\`❌ [API-TEST] \${test.name} - Exception: \`, error);
        }
        
        // Esperar un poco entre tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('🧪 [API-TEST] Tests completados');
}

// Ejecutar tests
testAPI();
`;
    
    console.log('🧪 [DEBUG-SERVER] Script de test creado');
    return testCode;
}

// Función para crear un monitor de errores en tiempo real
function createErrorMonitor() {
    const monitorCode = `
// =====================================================
// 📊 MONITOR DE ERRORES EN TIEMPO REAL
// =====================================================

class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Interceptar errores de JavaScript
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        // Interceptar errores de Promise
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Promise Rejection', {
                reason: event.reason,
                stack: event.reason?.stack
            });
        });
        
        // Interceptar errores de fetch
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            try {
                const response = await originalFetch.apply(this, args);
                if (!response.ok) {
                    console.error('🌐 [ERROR-MONITOR] Fetch error:', {
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText
                    });
                }
                return response;
            } catch (error) {
                console.error('🌐 [ERROR-MONITOR] Fetch exception:', {
                    url: args[0],
                    error: error.message
                });
                throw error;
            }
        };
    }
    
    logError(type, details) {
        const error = {
            type: type,
            details: details,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        this.errors.push(error);
        console.error(\`📊 [ERROR-MONITOR] \${type}:\`, error);
    }
    
    getErrors() {
        return this.errors;
    }
    
    clearErrors() {
        this.errors = [];
    }
}

// Inicializar monitor
const errorMonitor = new ErrorMonitor();

// Exportar para uso manual
window.errorMonitor = errorMonitor;
`;
    
    console.log('📊 [DEBUG-SERVER] Monitor de errores creado');
    return monitorCode;
}

// Función principal
function createDebugSystem() {
    console.log('🔧 [DEBUG-SYSTEM] Creando sistema completo de debug...');
    
    const serverDebug = addServerDebug();
    const apiTest = createAPITest();
    const errorMonitor = createErrorMonitor();
    
    const fullDebugSystem = serverDebug + '\n\n' + apiTest + '\n\n' + errorMonitor;
    
    console.log('✅ [DEBUG-SYSTEM] Sistema de debug completo creado');
    return fullDebugSystem;
}

// Exportar funciones
window.addServerDebug = addServerDebug;
window.createAPITest = createAPITest;
window.createErrorMonitor = createErrorMonitor;
window.createDebugSystem = createDebugSystem;
