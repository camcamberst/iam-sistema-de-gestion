// =====================================================
// 🧪 PRUEBAS ESPECÍFICAS: CREAR Y EDITAR USUARIOS
// =====================================================
// Verificar flujo completo de creación y edición
// con diferentes configuraciones de grupos
// =====================================================

const BASE_URL = 'https://iam-sistema-de-gestion.vercel.app';

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
// 📋 DATOS DE PRUEBA
// =====================================================

const TEST_USERS = [
  {
    name: 'Test Usuario Sede MP',
    email: 'test.sedemp@example.com',
    role: 'modelo',
    group: 'Sede MP',
    expectedRoom: true,
    expectedJornada: true,
    description: 'Usuario normal con Room y Jornada requeridos'
  },
  {
    name: 'Test Usuario Satélites',
    email: 'test.satelites@example.com', 
    role: 'modelo',
    group: 'Satélites',
    expectedRoom: false, // NO requerido
    expectedJornada: false, // Opcional
    description: 'Usuario Satélites - Room NO requerido, Jornada opcional'
  },
  {
    name: 'Test Usuario Otros',
    email: 'test.otros@example.com',
    role: 'modelo', 
    group: 'Otros',
    expectedRoom: false, // Opcional
    expectedJornada: false, // Opcional
    description: 'Usuario Otros - Room y Jornada opcionales'
  }
];

// =====================================================
// 🧪 PRUEBAS ESPECÍFICAS
// =====================================================

async function testCrearEditarUsuarios() {
  console.log('🚀 INICIANDO PRUEBAS DE CREAR Y EDITAR USUARIOS');
  console.log('=' .repeat(60));
  
  let testsPassed = 0;
  let totalTests = 0;
  
  // =====================================================
  // 1. OBTENER DATOS NECESARIOS
  // =====================================================
  
  console.log('\n📊 1. OBTENIENDO DATOS DEL SISTEMA');
  console.log('-'.repeat(40));
  
  // Obtener grupos
  const groupsResponse = await makeRequest(`${BASE_URL}/api/groups`);
  if (!groupsResponse.success) {
    console.log('❌ No se pudieron obtener los grupos');
    return;
  }
  
  const groups = groupsResponse.data.groups;
  console.log(`✅ Grupos obtenidos: ${groups.length}`);
  
  // Obtener rooms por grupo
  const roomsByGroup = {};
  for (const group of groups) {
    const roomsResponse = await makeRequest(`${BASE_URL}/api/groups/rooms?groupId=${group.id}`);
    if (roomsResponse.success) {
      roomsByGroup[group.name] = roomsResponse.data.rooms || [];
      console.log(`   ${group.name}: ${roomsByGroup[group.name].length} rooms`);
    }
  }
  
  // =====================================================
  // 2. PRUEBAS DE CREACIÓN DE USUARIOS
  // =====================================================
  
  console.log('\n👤 2. PRUEBAS DE CREACIÓN DE USUARIOS');
  console.log('-'.repeat(40));
  
  const createdUsers = [];
  
  for (const testUser of TEST_USERS) {
    console.log(`\n🧪 Probando: ${testUser.description}`);
    
    // Encontrar el grupo
    const group = groups.find(g => g.name === testUser.group);
    if (!group) {
      console.log(`❌ Grupo ${testUser.group} no encontrado`);
      continue;
    }
    
    // Preparar datos del usuario
    const userData = {
      name: testUser.name,
      email: testUser.email,
      password: 'TestPassword123!',
      role: testUser.role,
      group_ids: [group.id],
      is_active: true
    };
    
    // Agregar Room y Jornada si están disponibles
    const availableRooms = roomsByGroup[testUser.group] || [];
    if (availableRooms.length > 0) {
      userData.room_id = availableRooms[0].id;
      userData.jornada = 'MAÑANA';
    }
    
    // Test: Crear usuario
    totalTests++;
    const createResponse = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    if (logTest(`Crear usuario ${testUser.name}`, createResponse)) {
      testsPassed++;
      if (createResponse.data?.user) {
        createdUsers.push({
          ...testUser,
          id: createResponse.data.user.id,
          created: true
        });
        console.log(`   Usuario creado con ID: ${createResponse.data.user.id}`);
      }
    }
  }
  
  // =====================================================
  // 3. PRUEBAS DE EDICIÓN DE USUARIOS
  // =====================================================
  
  console.log('\n✏️ 3. PRUEBAS DE EDICIÓN DE USUARIOS');
  console.log('-'.repeat(40));
  
  for (const user of createdUsers) {
    if (!user.created) continue;
    
    console.log(`\n🧪 Editando: ${user.name}`);
    
    // Obtener asignaciones actuales
    totalTests++;
    const assignmentsResponse = await makeRequest(`${BASE_URL}/api/assignments/${user.id}`);
    
    if (logTest(`Obtener asignaciones de ${user.name}`, assignmentsResponse)) {
      testsPassed++;
      if (assignmentsResponse.data?.assignments) {
        console.log(`   Asignaciones encontradas: ${assignmentsResponse.data.assignments.length}`);
        assignmentsResponse.data.assignments.forEach(assignment => {
          console.log(`     - Room: ${assignment.room_name || 'N/A'}, Jornada: ${assignment.jornada || 'N/A'}`);
        });
      }
    }
    
    // Preparar datos de actualización
    const updateData = {
      id: user.id,
      name: user.name + ' (Editado)',
      email: user.email,
      password: '', // No cambiar contraseña
      role: user.role,
      group_ids: user.group_ids || [],
      is_active: true
    };
    
    // Agregar Room y Jornada si están disponibles
    const availableRooms = roomsByGroup[user.group] || [];
    if (availableRooms.length > 0) {
      updateData.room_id = availableRooms[0].id;
      updateData.jornada = 'TARDE'; // Cambiar jornada
    }
    
    // Test: Actualizar usuario
    totalTests++;
    const updateResponse = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    if (logTest(`Actualizar usuario ${user.name}`, updateResponse)) {
      testsPassed++;
      console.log(`   Usuario actualizado exitosamente`);
    }
  }
  
  // =====================================================
  // 4. PRUEBAS DE VALIDACIÓN POR GRUPO
  // =====================================================
  
  console.log('\n⚙️ 4. PRUEBAS DE VALIDACIÓN POR GRUPO');
  console.log('-'.repeat(40));
  
  for (const user of createdUsers) {
    if (!user.created) continue;
    
    console.log(`\n🧪 Validando configuración para: ${user.name} (${user.group})`);
    
    // Verificar si el usuario tiene Room y Jornada según las reglas del grupo
    totalTests++;
    const assignmentsResponse = await makeRequest(`${BASE_URL}/api/assignments/${user.id}`);
    
    if (assignmentsResponse.success && assignmentsResponse.data?.assignments) {
      const hasRoom = assignmentsResponse.data.assignments.some(a => a.room_id);
      const hasJornada = assignmentsResponse.data.assignments.some(a => a.jornada);
      
      let validationPassed = true;
      
      // Validar según las reglas del grupo
      if (user.group === 'Satélites') {
        // Satélites: Room NO requerido, Jornada opcional
        if (hasRoom) {
          console.log(`   ⚠️  Satélites tiene Room asignado (debería ser opcional)`);
        }
        console.log(`   ✅ Satélites: Room=${hasRoom ? 'Sí' : 'No'}, Jornada=${hasJornada ? 'Sí' : 'No'}`);
      } else if (user.group === 'Otros') {
        // Otros: Room y Jornada opcionales
        console.log(`   ✅ Otros: Room=${hasRoom ? 'Sí' : 'No'}, Jornada=${hasJornada ? 'Sí' : 'No'}`);
      } else {
        // Otros grupos: Room y Jornada requeridos
        if (!hasRoom || !hasJornada) {
          console.log(`   ⚠️  ${user.group} debería tener Room y Jornada requeridos`);
          validationPassed = false;
        } else {
          console.log(`   ✅ ${user.group}: Room=Sí, Jornada=Sí`);
        }
      }
      
      if (logTest(`Validación de configuración ${user.group}`, { success: validationPassed })) {
        testsPassed++;
      }
    } else {
      logTest(`Validación de configuración ${user.group}`, { success: false }, 'No se pudieron obtener asignaciones');
    }
  }
  
  // =====================================================
  // 5. LIMPIEZA: ELIMINAR USUARIOS DE PRUEBA
  // =====================================================
  
  console.log('\n🧹 5. LIMPIEZA: ELIMINAR USUARIOS DE PRUEBA');
  console.log('-'.repeat(40));
  
  for (const user of createdUsers) {
    if (!user.created) continue;
    
    totalTests++;
    const deleteResponse = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'DELETE',
      body: JSON.stringify({ id: user.id })
    });
    
    if (logTest(`Eliminar usuario ${user.name}`, deleteResponse)) {
      testsPassed++;
    }
  }
  
  // =====================================================
  // 📊 RESUMEN DE PRUEBAS
  // =====================================================
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS DE CREAR/EDITAR USUARIOS');
  console.log('='.repeat(60));
  console.log(`✅ Pruebas exitosas: ${testsPassed}/${totalTests}`);
  console.log(`❌ Pruebas fallidas: ${totalTests - testsPassed}/${totalTests}`);
  console.log(`📈 Porcentaje de éxito: ${Math.round((testsPassed / totalTests) * 100)}%`);
  
  // =====================================================
  // 🎯 ANÁLISIS DE RESULTADOS
  // =====================================================
  
  console.log('\n🎯 ANÁLISIS DE RESULTADOS:');
  console.log('-'.repeat(40));
  
  if (testsPassed === totalTests) {
    console.log('✅ Todas las pruebas de crear/editar usuarios pasaron');
    console.log('📋 Sistema listo para configuraciones especiales por grupo');
  } else {
    console.log('⚠️  Algunas pruebas fallaron');
    console.log('📋 Revisar errores antes de continuar');
  }
  
  console.log('\n🚀 Pruebas de crear/editar usuarios completadas');
}

// =====================================================
// 🚀 EJECUTAR PRUEBAS
// =====================================================

if (typeof window === 'undefined') {
  // Ejecutar en Node.js
  testCrearEditarUsuarios().catch(console.error);
} else {
  // Ejecutar en navegador
  window.testCrearEditarUsuarios = testCrearEditarUsuarios;
  console.log('🧪 Script cargado. Ejecutar: testCrearEditarUsuarios()');
}
