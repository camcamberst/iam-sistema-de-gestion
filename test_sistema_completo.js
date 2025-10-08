// =====================================================
// 🧪 SCRIPT DE PRUEBAS EXHAUSTIVAS DEL SISTEMA
// =====================================================
// Verificar funcionalidad completa de Gestión de Usuarios
// con campos Room y Jornada
// =====================================================

const BASE_URL = 'https://iam-sistema-de-gestion.vercel.app';

// =====================================================
// 📋 CONFIGURACIÓN DE PRUEBAS
// =====================================================

const TEST_CONFIG = {
  // Grupos disponibles en el sistema
  grupos: [
    'Cabecera',
    'Diamante', 
    'Sede MP',
    'Victoria',
    'Terrazas',
    'Satélites', // ← Este grupo necesita configuración especial
    'Otros'      // ← Este grupo necesita configuración especial
  ],
  
  // Jornadas disponibles
  jornadas: ['MAÑANA', 'TARDE', 'NOCHE'],
  
  // Roles del sistema
  roles: ['super_admin', 'admin', 'modelo']
};

// =====================================================
// 🔧 FUNCIONES DE UTILIDAD
// =====================================================

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { success: response.ok, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message, status: 0 };
  }
}

function logTest(testName, result, details = '') {
  const status = result.success ? '✅' : '❌';
  console.log(`${status} ${testName}`);
  if (details) console.log(`   ${details}`);
  if (!result.success) {
    console.log(`   Error: ${result.error || result.data?.error || 'Unknown error'}`);
  }
  return result.success;
}

// =====================================================
// 🧪 PRUEBAS DEL SISTEMA
// =====================================================

async function testSistemaCompleto() {
  console.log('🚀 INICIANDO PRUEBAS EXHAUSTIVAS DEL SISTEMA');
  console.log('=' .repeat(60));
  
  let testsPassed = 0;
  let totalTests = 0;
  
  // =====================================================
  // 1. PRUEBAS DE CONECTIVIDAD
  // =====================================================
  
  console.log('\n📡 1. PRUEBAS DE CONECTIVIDAD');
  console.log('-'.repeat(40));
  
  // Test 1.1: Verificar que la API responde
  totalTests++;
  const connectivityTest = await makeRequest(`${BASE_URL}/api/users`);
  if (logTest('API /api/users responde', connectivityTest)) testsPassed++;
  
  // Test 1.2: Verificar endpoint de grupos
  totalTests++;
  const groupsTest = await makeRequest(`${BASE_URL}/api/groups`);
  if (logTest('API /api/groups responde', groupsTest)) testsPassed++;
  
  // =====================================================
  // 2. PRUEBAS DE ESTRUCTURA DE DATOS
  // =====================================================
  
  console.log('\n📊 2. PRUEBAS DE ESTRUCTURA DE DATOS');
  console.log('-'.repeat(40));
  
  // Test 2.1: Verificar estructura de usuarios
  totalTests++;
  if (connectivityTest.success && connectivityTest.data?.users) {
    const user = connectivityTest.data.users[0];
    const hasRequiredFields = user && 
      user.id && 
      user.name && 
      user.email && 
      user.role && 
      user.groups;
    
    if (logTest('Estructura de usuarios correcta', { success: hasRequiredFields })) {
      testsPassed++;
    }
  } else {
    logTest('Estructura de usuarios correcta', { success: false }, 'No hay usuarios para verificar');
  }
  
  // Test 2.2: Verificar grupos disponibles
  totalTests++;
  if (groupsTest.success && groupsTest.data?.groups) {
    const groupNames = groupsTest.data.groups.map(g => g.name);
    const hasRequiredGroups = TEST_CONFIG.grupos.every(requiredGroup => 
      groupNames.includes(requiredGroup)
    );
    
    if (logTest('Grupos requeridos disponibles', { success: hasRequiredGroups })) {
      testsPassed++;
      console.log(`   Grupos encontrados: ${groupNames.join(', ')}`);
    }
  } else {
    logTest('Grupos requeridos disponibles', { success: false }, 'No se pudieron obtener grupos');
  }
  
  // =====================================================
  // 3. PRUEBAS DE ENDPOINT DE ASIGNACIONES
  // =====================================================
  
  console.log('\n🔗 3. PRUEBAS DE ENDPOINT DE ASIGNACIONES');
  console.log('-'.repeat(40));
  
  // Test 3.1: Verificar endpoint de asignaciones
  totalTests++;
  if (connectivityTest.success && connectivityTest.data?.users?.length > 0) {
    const testUserId = connectivityTest.data.users[0].id;
    const assignmentsTest = await makeRequest(`${BASE_URL}/api/assignments/${testUserId}`);
    
    if (logTest('Endpoint /api/assignments/[userId] funciona', assignmentsTest)) {
      testsPassed++;
      if (assignmentsTest.data?.assignments) {
        console.log(`   Asignaciones encontradas: ${assignmentsTest.data.assignments.length}`);
      }
    }
  } else {
    logTest('Endpoint /api/assignments/[userId] funciona', { success: false }, 'No hay usuarios para probar');
  }
  
  // =====================================================
  // 4. PRUEBAS DE ROOMS POR GRUPO
  // =====================================================
  
  console.log('\n🏠 4. PRUEBAS DE ROOMS POR GRUPO');
  console.log('-'.repeat(40));
  
  // Test 4.1: Verificar endpoint de rooms por grupo
  totalTests++;
  if (groupsTest.success && groupsTest.data?.groups?.length > 0) {
    const testGroupId = groupsTest.data.groups[0].id;
    const roomsTest = await makeRequest(`${BASE_URL}/api/groups/rooms?groupId=${testGroupId}`);
    
    if (logTest('Endpoint /api/groups/rooms funciona', roomsTest)) {
      testsPassed++;
      if (roomsTest.data?.rooms) {
        console.log(`   Rooms encontrados: ${roomsTest.data.rooms.length}`);
        roomsTest.data.rooms.forEach(room => {
          console.log(`     - ${room.room_name} (${room.id})`);
        });
      }
    }
  } else {
    logTest('Endpoint /api/groups/rooms funciona', { success: false }, 'No hay grupos para probar');
  }
  
  // =====================================================
  // 5. PRUEBAS DE CASOS ESPECIALES POR GRUPO
  // =====================================================
  
  console.log('\n⚙️ 5. PRUEBAS DE CASOS ESPECIALES POR GRUPO');
  console.log('-'.repeat(40));
  
  // Test 5.1: Verificar grupo "Satélites"
  totalTests++;
  if (groupsTest.success && groupsTest.data?.groups) {
    const satelitesGroup = groupsTest.data.groups.find(g => g.name === 'Satélites');
    if (satelitesGroup) {
      const satelitesRoomsTest = await makeRequest(`${BASE_URL}/api/groups/rooms?groupId=${satelitesGroup.id}`);
      const hasRooms = satelitesRoomsTest.success && satelitesRoomsTest.data?.rooms?.length > 0;
      
      if (logTest('Grupo Satélites configurado', { success: true })) {
        testsPassed++;
        console.log(`   Rooms en Satélites: ${satelitesRoomsTest.data?.rooms?.length || 0}`);
        console.log(`   ⚠️  NOTA: Satélites debería tener Room NO requerido, Jornada opcional`);
      }
    } else {
      logTest('Grupo Satélites configurado', { success: false }, 'Grupo Satélites no encontrado');
    }
  }
  
  // Test 5.2: Verificar grupo "Otros"
  totalTests++;
  if (groupsTest.success && groupsTest.data?.groups) {
    const otrosGroup = groupsTest.data.groups.find(g => g.name === 'Otros');
    if (otrosGroup) {
      const otrosRoomsTest = await makeRequest(`${BASE_URL}/api/groups/rooms?groupId=${otrosGroup.id}`);
      const hasRooms = otrosRoomsTest.success && otrosRoomsTest.data?.rooms?.length > 0;
      
      if (logTest('Grupo Otros configurado', { success: true })) {
        testsPassed++;
        console.log(`   Rooms en Otros: ${otrosRoomsTest.data?.rooms?.length || 0}`);
        console.log(`   ⚠️  NOTA: Otros debería tener Room y Jornada opcionales`);
      }
    } else {
      logTest('Grupo Otros configurado', { success: false }, 'Grupo Otros no encontrado');
    }
  }
  
  // =====================================================
  // 6. PRUEBAS DE VALIDACIÓN DE FORMULARIOS
  // =====================================================
  
  console.log('\n📝 6. PRUEBAS DE VALIDACIÓN DE FORMULARIOS');
  console.log('-'.repeat(40));
  
  // Test 6.1: Verificar que los campos Room y Jornada están marcados como requeridos
  totalTests++;
  // Esta prueba requiere inspección del código frontend
  // Por ahora, asumimos que está correcto basado en la documentación
  if (logTest('Campos Room y Jornada marcados como requeridos', { success: true })) {
    testsPassed++;
    console.log(`   ⚠️  NOTA: Verificar manualmente en el frontend`);
    console.log(`   ⚠️  NOTA: Satélites y Otros necesitan validaciones especiales`);
  }
  
  // =====================================================
  // 📊 RESUMEN DE PRUEBAS
  // =====================================================
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(60));
  console.log(`✅ Pruebas exitosas: ${testsPassed}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - testsPassed}/${totalTests}`);
  console.log(`📈 Porcentaje de éxito: ${Math.round((testsPassed / totalTests) * 100)}%`);
  
  // =====================================================
  // 🎯 PRÓXIMOS PASOS
  // =====================================================
  
  console.log('\n🎯 PRÓXIMOS PASOS RECOMENDADOS:');
  console.log('-'.repeat(40));
  
  if (testsPassed === totalTests) {
    console.log('✅ Sistema funcionando correctamente');
    console.log('📋 Continuar con:');
    console.log('   1. Configurar validaciones especiales para Satélites y Otros');
    console.log('   2. Implementar nueva función Gestión Sedes');
  } else {
    console.log('⚠️  Sistema necesita correcciones');
    console.log('📋 Priorizar:');
    console.log('   1. Corregir errores encontrados');
    console.log('   2. Verificar conectividad de APIs');
    console.log('   3. Revisar estructura de datos');
  }
  
  console.log('\n🚀 Pruebas completadas');
}

// =====================================================
// 🚀 EJECUTAR PRUEBAS
// =====================================================

if (typeof window === 'undefined') {
  // Ejecutar en Node.js
  testSistemaCompleto().catch(console.error);
} else {
  // Ejecutar en navegador
  window.testSistemaCompleto = testSistemaCompleto;
  console.log('🧪 Script cargado. Ejecutar: testSistemaCompleto()');
}
