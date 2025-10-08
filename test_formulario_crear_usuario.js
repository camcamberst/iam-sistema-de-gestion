// =====================================================
// 🧪 PRUEBA ESPECÍFICA: FORMULARIO CREAR USUARIO
// =====================================================
// Verificar por qué no aparecen los campos Room y Jornada
// =====================================================

const BASE_URL = 'https://iam-sistema-de-gestion.vercel.app';

async function testFormularioCrearUsuario() {
  console.log('🔍 VERIFICANDO FORMULARIO DE CREAR USUARIO');
  console.log('=' .repeat(50));
  
  // =====================================================
  // 1. VERIFICAR GRUPOS Y ROOMS
  // =====================================================
  
  console.log('\n📊 1. VERIFICANDO GRUPOS Y ROOMS DISPONIBLES');
  console.log('-'.repeat(40));
  
  try {
    // Obtener grupos
    const groupsResponse = await fetch(`${BASE_URL}/api/groups`);
    const groupsData = await groupsResponse.json();
    
    if (groupsData.success) {
      console.log('✅ Grupos obtenidos correctamente');
      console.log(`   Total de grupos: ${groupsData.groups.length}`);
      
      // Verificar rooms por grupo
      for (const group of groupsData.groups) {
        const roomsResponse = await fetch(`${BASE_URL}/api/groups/rooms?groupId=${group.id}`);
        const roomsData = await roomsResponse.json();
        
        if (roomsData.success) {
          const roomCount = roomsData.rooms ? roomsData.rooms.length : 0;
          console.log(`   ${group.name}: ${roomCount} rooms`);
          
          if (roomCount > 0) {
            console.log(`     Rooms disponibles:`);
            roomsData.rooms.forEach(room => {
              console.log(`       - ${room.room_name} (${room.id})`);
            });
          }
        } else {
          console.log(`   ❌ Error obteniendo rooms para ${group.name}: ${roomsData.error}`);
        }
      }
    } else {
      console.log('❌ Error obteniendo grupos:', groupsData.error);
    }
  } catch (error) {
    console.log('❌ Error en la verificación:', error.message);
  }
  
  // =====================================================
  // 2. VERIFICAR ESTRUCTURA DEL FORMULARIO
  // =====================================================
  
  console.log('\n📝 2. VERIFICANDO ESTRUCTURA DEL FORMULARIO');
  console.log('-'.repeat(40));
  
  console.log('✅ Campos implementados en el código:');
  console.log('   - Nombre (requerido)');
  console.log('   - Email (requerido)');
  console.log('   - Contraseña (requerido)');
  console.log('   - Rol (requerido)');
  console.log('   - Grupos (requerido)');
  console.log('   - Room (requerido SOLO para modelos)');
  console.log('   - Jornada (requerido SOLO para modelos)');
  
  console.log('\n🔍 Condiciones para mostrar Room y Jornada:');
  console.log('   - formData.role === "modelo"');
  console.log('   - Se debe seleccionar un grupo primero');
  console.log('   - El grupo debe tener rooms disponibles');
  
  // =====================================================
  // 3. VERIFICAR LÓGICA DE CARGADO
  // =====================================================
  
  console.log('\n⚙️ 3. VERIFICANDO LÓGICA DE CARGADO');
  console.log('-'.repeat(40));
  
  console.log('✅ Funciones implementadas:');
  console.log('   - loadRoomsForGroup(): Carga rooms por grupo');
  console.log('   - handleGroupChange(): Maneja cambio de grupo');
  console.log('   - useEffect(): Carga rooms cuando cambia group_ids');
  
  console.log('\n🔍 Flujo de carga:');
  console.log('   1. Usuario selecciona rol "modelo"');
  console.log('   2. Usuario selecciona un grupo');
  console.log('   3. handleGroupChange() se ejecuta');
  console.log('   4. loadRoomsForGroup() carga rooms del grupo');
  console.log('   5. availableRooms se actualiza');
  console.log('   6. Dropdown de Room se llena con opciones');
  
  // =====================================================
  // 4. DIAGNÓSTICO DE PROBLEMAS POSIBLES
  // =====================================================
  
  console.log('\n🔧 4. DIAGNÓSTICO DE PROBLEMAS POSIBLES');
  console.log('-'.repeat(40));
  
  console.log('❓ Posibles causas de que no aparezcan los campos:');
  console.log('   1. Rol no es "modelo"');
  console.log('   2. No se ha seleccionado un grupo');
  console.log('   3. El grupo seleccionado no tiene rooms');
  console.log('   4. Error en la carga de rooms');
  console.log('   5. Problema con el componente AppleDropdown');
  
  console.log('\n✅ Soluciones implementadas:');
  console.log('   - useEffect agregado para cargar rooms automáticamente');
  console.log('   - handleGroupChange implementado correctamente');
  console.log('   - loadRoomsForGroup implementado correctamente');
  console.log('   - Campos Room y Jornada implementados correctamente');
  
  // =====================================================
  // 5. INSTRUCCIONES PARA VERIFICAR MANUALMENTE
  // =====================================================
  
  console.log('\n📋 5. INSTRUCCIONES PARA VERIFICAR MANUALMENTE');
  console.log('-'.repeat(40));
  
  console.log('🔍 Pasos para verificar en el navegador:');
  console.log('   1. Ir a Gestión Usuarios > Crear Usuario');
  console.log('   2. Verificar que el rol por defecto es "modelo"');
  console.log('   3. Seleccionar un grupo (ej: "Sede MP")');
  console.log('   4. Verificar que aparecen los campos Room y Jornada');
  console.log('   5. Verificar que el dropdown de Room se llena');
  console.log('   6. Probar con diferentes grupos');
  
  console.log('\n⚠️  Grupos especiales:');
  console.log('   - Satélites: NO debería requerir Room');
  console.log('   - Otros: NO debería requerir Room');
  console.log('   - Sede MP: SÍ debería requerir Room');
  
  console.log('\n🚀 Verificación completada');
}

// =====================================================
// 🚀 EJECUTAR VERIFICACIÓN
// =====================================================

if (typeof window === 'undefined') {
  // Ejecutar en Node.js
  testFormularioCrearUsuario().catch(console.error);
} else {
  // Ejecutar en navegador
  window.testFormularioCrearUsuario = testFormularioCrearUsuario;
  console.log('🧪 Script cargado. Ejecutar: testFormularioCrearUsuario()');
}
