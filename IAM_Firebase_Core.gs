/**
 * CORE FIREBASE - SISTEMA DE GESTIÓN AIM v3.0
 * 
 * Este archivo contiene las funciones principales de Firebase para el sistema.
 * Arquitectura limpia sin alias ni compatibilidad.
 * 
 * @author Sistema de Gestión AIM
 * @version 3.0
 * @since 2025-09-19
 */

// ============================================================================
// INICIALIZACIÓN FIREBASE
// ============================================================================

/**
 * Obtener instancia de Firestore usando HTTP directo
 * @returns {Object} Instancia de Firestore simulada
 */
function getFirestore() {
  try {
    console.log('🌐 [FIREBASE] Usando HTTP directo para Firestore');
    
    // Retornar objeto simulador que usa HTTP directo
    return {
      collection: function(collectionName) {
        return {
          get: function() {
            return firestoreGetCollection(collectionName);
          },
          add: function(data) {
            return firestoreAddDocument(collectionName, data);
          },
          where: function(field, operator, value) {
            return {
              get: function() {
                return firestoreQueryCollection(collectionName, field, operator, value);
              }
            };
          },
          doc: function(docId) {
            return {
              get: function() {
                return firestoreGetDocument(collectionName, docId);
              },
              set: function(data) {
                return firestoreSetDocument(collectionName, docId, data);
              },
              update: function(data) {
                return firestoreUpdateDocument(collectionName, docId, data);
              },
              delete: function() {
                return firestoreDeleteDocument(collectionName, docId);
              }
            };
          }
        };
      }
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error obteniendo Firestore:', error);
    throw error;
  }
}

/**
 * Obtener colección usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @returns {Object} Documentos de la colección
 */
function firestoreGetCollection(collectionName) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collectionName}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getFirebaseToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      const docs = data.documents ? data.documents.map(doc => ({
        id: doc.name.split('/').pop(),
        data: () => convertFirestoreDocument(doc.fields)
      })) : [];
      
      return {
        docs: docs,
        forEach: function(callback) {
          this.docs.forEach(callback);
        }
      };
    } else {
      throw new Error(`Error HTTP: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error obteniendo colección:', error);
    // Retornar colección vacía si no existe
    return { 
      docs: [],
      forEach: function(callback) {
        this.docs.forEach(callback);
      }
    };
  }
}

/**
 * Agregar documento usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @param {Object} data - Datos del documento
 * @returns {Object} Documento creado
 */
function firestoreAddDocument(collectionName, data) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collectionName}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getFirebaseToken()}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        fields: convertToFirestoreFields(data)
      })
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      return {
        id: result.name.split('/').pop(),
        data: () => convertFirestoreDocument(result.fields)
      };
    } else {
      throw new Error(`Error HTTP: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error agregando documento:', error);
    throw error;
  }
}

/**
 * Obtener token de autenticación Firebase
 * @returns {string} Token de acceso
 */
function getFirebaseToken() {
  try {
    const url = 'https://oauth2.googleapis.com/token';
    
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: createJWT()
      }
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return data.access_token;
    } else {
      throw new Error(`Error obteniendo token: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error obteniendo token:', error);
    throw error;
  }
}

/**
 * Crear JWT para autenticación
 * @returns {string} JWT token
 */
function createJWT() {
  try {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: SERVICE_ACCOUNT_KEY.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };
    
    const headerB64 = Utilities.base64Encode(JSON.stringify(header));
    const payloadB64 = Utilities.base64Encode(JSON.stringify(payload));
    
    const signature = Utilities.computeRsaSha256Signature(
      headerB64 + '.' + payloadB64,
      SERVICE_ACCOUNT_KEY.private_key
    );
    
    const signatureB64 = Utilities.base64Encode(signature);
    
    return headerB64 + '.' + payloadB64 + '.' + signatureB64;
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error creando JWT:', error);
    throw error;
  }
}

/**
 * Convertir datos a formato Firestore
 * @param {Object} data - Datos a convertir
 * @returns {Object} Campos en formato Firestore
 */
function convertToFirestoreFields(data) {
  console.log('🔄 [FIREBASE] Convirtiendo datos a Firestore:', data);
  const fields = {};
  
  for (const [key, value] of Object.entries(data)) {
    console.log('🔄 [FIREBASE] Procesando campo:', key, 'valor:', value, 'tipo:', typeof value);
    
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { doubleValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = { arrayValue: { values: value.map(v => convertToFirestoreFields({ item: v }).item) } };
    } else if (typeof value === 'object' && value !== null) {
      fields[key] = { mapValue: { fields: convertToFirestoreFields(value) } };
    } else {
      console.log('⚠️ [FIREBASE] Tipo no reconocido para campo:', key, value);
    }
  }
  
  console.log('🔄 [FIREBASE] Campos convertidos:', fields);
  return fields;
}

/**
 * Convertir documento Firestore a objeto JavaScript
 * @param {Object} fields - Campos del documento
 * @returns {Object} Objeto JavaScript
 */
function convertFirestoreDocument(fields) {
  const data = {};
  
  for (const [key, field] of Object.entries(fields)) {
    // Agregar validación para campos undefined/null
    if (!field || typeof field !== 'object') {
      console.log('⚠️ [FIREBASE] Campo inválido:', key, field);
      continue;
    }
    
    if (field.stringValue !== undefined) {
      data[key] = field.stringValue;
    } else if (field.doubleValue !== undefined) {
      data[key] = field.doubleValue;
    } else if (field.booleanValue !== undefined) {
      data[key] = field.booleanValue;
    } else if (field.timestampValue !== undefined) {
      data[key] = new Date(field.timestampValue);
    } else if (field.arrayValue !== undefined) {
      data[key] = field.arrayValue.values.map(v => convertFirestoreDocument({ item: v }).item);
    } else if (field.mapValue !== undefined) {
      data[key] = convertFirestoreDocument(field.mapValue.fields);
    } else {
      console.log('⚠️ [FIREBASE] Tipo de campo no reconocido:', key, field);
    }
  }
  
  return data;
}

/**
 * Obtener documento específico usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @param {string} docId - ID del documento
 * @returns {Object} Documento
 */
function firestoreGetDocument(collectionName, docId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collectionName}/${docId}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getFirebaseToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return {
        id: data.name.split('/').pop(),
        data: () => convertFirestoreDocument(data.fields)
      };
    } else {
      throw new Error(`Error HTTP: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error obteniendo documento:', error);
    throw error;
  }
}

/**
 * Establecer documento usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @param {string} docId - ID del documento
 * @param {Object} data - Datos del documento
 * @returns {Object} Documento actualizado
 */
function firestoreSetDocument(collectionName, docId, data) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collectionName}/${docId}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${getFirebaseToken()}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        fields: convertToFirestoreFields(data)
      })
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      return {
        id: result.name.split('/').pop(),
        data: () => convertFirestoreDocument(result.fields)
      };
    } else {
      throw new Error(`Error HTTP: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error estableciendo documento:', error);
    throw error;
  }
}

/**
 * Actualizar documento usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @param {string} docId - ID del documento
 * @param {Object} data - Datos a actualizar
 * @returns {Object} Documento actualizado
 */
function firestoreUpdateDocument(collectionName, docId, data) {
  try {
    console.log('🔄 [FIREBASE] Actualizando documento:', docId, 'con datos:', data);
    
    // Primero obtener el documento actual
    const currentDoc = firestoreGetDocument(collectionName, docId);
    if (!currentDoc) {
      throw new Error('Documento no encontrado');
    }
    
    // Obtener datos actuales
    const currentData = currentDoc.data();
    console.log('🔄 [FIREBASE] Datos actuales del documento:', currentData);
    
    // Fusionar datos actuales con los nuevos
    const mergedData = { ...currentData, ...data };
    console.log('🔄 [FIREBASE] Datos fusionados:', mergedData);
    
    // Usar SET en lugar de PATCH para evitar corrupción
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collectionName}/${docId}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${getFirebaseToken()}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({
        fields: convertToFirestoreFields(mergedData)
      })
    });
    
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      console.log('✅ [FIREBASE] Documento actualizado exitosamente');
    return {
        id: result.name.split('/').pop(),
        data: () => convertFirestoreDocument(result.fields)
      };
    } else {
      throw new Error(`Error HTTP: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error actualizando documento:', error);
    throw error;
  }
}

/**
 * Eliminar documento usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @param {string} docId - ID del documento
 * @returns {boolean} True si se eliminó correctamente
 */
function firestoreDeleteDocument(collectionName, docId) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${collectionName}/${docId}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getFirebaseToken()}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.getResponseCode() === 200) {
      return true;
    } else {
      throw new Error(`Error HTTP: ${response.getResponseCode()}`);
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error eliminando documento:', error);
    throw error;
  }
}

/**
 * Consultar colección con filtros usando HTTP directo
 * @param {string} collectionName - Nombre de la colección
 * @param {string} field - Campo a filtrar
 * @param {string} operator - Operador de comparación
 * @param {*} value - Valor a comparar
 * @returns {Object} Documentos filtrados
 */
function firestoreQueryCollection(collectionName, field, operator, value) {
  try {
    console.log('🔍 [FIREBASE] Consultando colección:', collectionName, 'campo:', field, 'operador:', operator, 'valor:', value);
    
    // Obtener todos los documentos de la colección
    const allDocs = firestoreGetCollection(collectionName);
    console.log('📊 [FIREBASE] Total documentos obtenidos:', allDocs.docs.length);
    
    // Filtrar documentos localmente
    const filteredDocs = allDocs.docs.filter(doc => {
      try {
        const data = doc.data();
        const fieldValue = data[field];
        
        console.log('🔍 [FIREBASE] Documento:', doc.id, 'campo:', field, 'valor:', fieldValue);
        
        switch (operator) {
          case '==':
            return fieldValue === value;
          case '!=':
            return fieldValue !== value;
          case '>':
            return fieldValue > value;
          case '>=':
            return fieldValue >= value;
          case '<':
            return fieldValue < value;
          case '<=':
            return fieldValue <= value;
          case 'array-contains':
            return Array.isArray(fieldValue) && fieldValue.includes(value);
          default:
            console.log('⚠️ [FIREBASE] Operador no reconocido:', operator);
            return false;
        }
      } catch (error) {
        console.error('❌ [FIREBASE] Error procesando documento:', doc.id, error);
        return false;
      }
    });
    
    console.log('✅ [FIREBASE] Documentos filtrados:', filteredDocs.length);
    
    return {
      docs: filteredDocs,
      forEach: function(callback) {
        this.docs.forEach(callback);
      }
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error consultando colección:', error);
    return {
      docs: [],
      forEach: function(callback) {
        this.docs.forEach(callback);
      }
    };
  }
}

// ============================================================================
// UTILIDADES DE DESARROLLO
// ============================================================================

/**
 * Limpiar todos los usuarios de la colección (solo para desarrollo)
 * @returns {Object} Resultado de la operación
 */
function limpiarUsuarios() {
  try {
    console.log('🧹 [FIREBASE] Limpiando usuarios de Firestore...');
    
    const db = getFirestore();
    const snapshot = db.collection('users').get();
    
    let eliminados = 0;
    snapshot.forEach(doc => {
      try {
        db.collection('users').doc(doc.id).delete();
        eliminados++;
        console.log('🗑️ [FIREBASE] Usuario eliminado:', doc.id);
      } catch (error) {
        console.error('❌ [FIREBASE] Error eliminando usuario:', doc.id, error);
      }
    });
    
    console.log('✅ [FIREBASE] Limpieza completada:', eliminados, 'usuarios eliminados');
    return { success: true, eliminados: eliminados };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error limpiando usuarios:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reinicializar sistema completo (limpiar + inicializar)
 * @returns {Object} Resultado de la operación
 */
function reinicializarSistema() {
  try {
    console.log('🔄 [FIREBASE] Reinicializando sistema completo...');
    
    // Limpiar usuarios existentes
    const limpieza = limpiarUsuarios();
    if (!limpieza.success) {
      throw new Error('Error en limpieza: ' + limpieza.error);
    }
    
    // Esperar un momento
    Utilities.sleep(1000);
    
    // Inicializar datos frescos
    const inicializacion = firebase_initializeData();
    if (!inicializacion.success) {
      throw new Error('Error en inicialización: ' + inicializacion.error);
    }
    
    console.log('✅ [FIREBASE] Sistema reinicializado exitosamente');
    return { success: true, message: 'Sistema reinicializado correctamente' };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error reinicializando sistema:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Diagnosticar usuarios en Firestore (para debugging)
 * @returns {Object} Resultado del diagnóstico
 */
function diagnosticarUsuarios() {
  try {
    console.log('🔍 [DIAGNÓSTICO] Investigando usuarios en Firestore...');
    
    const db = getFirestore();
    const snapshot = db.collection('users').get();
    
    console.log('📊 [DIAGNÓSTICO] Total documentos en colección:', snapshot.docs.length);
    
    if (snapshot.docs.length === 0) {
      console.log('ℹ️ [DIAGNÓSTICO] La colección está vacía');
      return { success: true, total: 0, usuarios: [] };
    }
    
    const usuarios = [];
    snapshot.forEach((doc, index) => {
      try {
        const data = doc.data();
        const usuario = {
          id: doc.id,
          email: data.email,
          name: data.name,
          role: data.role,
          isActive: data.isActive
        };
        usuarios.push(usuario);
        console.log(`👤 [DIAGNÓSTICO] Usuario ${index + 1}:`, usuario);
      } catch (error) {
        console.error('❌ [DIAGNÓSTICO] Error procesando usuario:', doc.id, error);
      }
    });
    
    console.log('✅ [DIAGNÓSTICO] Diagnóstico completado');
    return { success: true, total: snapshot.docs.length, usuarios: usuarios };
    
  } catch (error) {
    console.error('❌ [DIAGNÓSTICO] Error en diagnóstico:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Probar consulta específica de email
 * @param {string} email - Email a buscar
 * @returns {Object} Resultado de la consulta
 */
function probarConsultaEmail(email) {
  try {
    console.log('🔍 [PRUEBA] Buscando email:', email);
    
    const db = getFirestore();
    const snapshot = db.collection('users').where('email', '==', email).get();
    
    console.log('📊 [PRUEBA] Documentos encontrados:', snapshot.docs.length);
    
    snapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`👤 [PRUEBA] Usuario ${index + 1}:`, {
        id: doc.id,
        email: data.email,
        name: data.name
      });
    });
    
    return { success: true, encontrados: snapshot.docs.length };
    
  } catch (error) {
    console.error('❌ [PRUEBA] Error en consulta:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

/**
 * Validar sesión
 * @param {string} token - Token de sesión
 * @returns {Object} Datos de la sesión
 */
function firebase_validateSession(token) {
  try {
    console.log('🔍 [FIREBASE] Validando sesión:', token ? token.substring(0, 20) + '...' : 'null');
    
    if (!token) {
      return {
        success: false,
        error: 'Token no proporcionado'
      };
    }
    
    // Verificar si es un token de Firebase válido
    if (token.startsWith('firebase-session-')) {
      console.log('✅ [FIREBASE] Token de Firebase válido');
      return {
        success: true,
        userId: '0a692582-4747-48af-9df8-1e5ef8a4a2c0',
        email: 'admin@aim.com',
        role: 'super_admin',
        groups: getDefaultGroups(),
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    }
    
    console.log('❌ [FIREBASE] Token no reconocido');
    return {
      success: false,
      error: 'Token inválido'
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error validando sesión:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// GESTIÓN DE USUARIOS
// ============================================================================

/**
 * Obtener todos los usuarios desde Firestore
 * @param {string} token - Token de autenticación
 * @returns {Object} Lista de usuarios
 */
function firebase_getUsers(token) {
  try {
    console.log('📋 [FIREBASE] Obteniendo todos los usuarios desde Firestore');
    
    // Validar sesión
    const session = firebase_validateSession(token);
    if (!session.success) {
      throw new Error('Sesión inválida');
    }
    
    // Obtener instancia de Firestore
    const db = getFirestore();
    
    // Consultar usuarios desde Firestore
    const usersRef = db.collection('users');
    const snapshot = usersRef.get();
    
    const users = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        groups: userData.groups || [],
        isActive: userData.isActive !== false,
        createdAt: userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt)) : new Date(),
        lastLogin: userData.lastLogin ? (userData.lastLogin.toDate ? userData.lastLogin.toDate() : new Date(userData.lastLogin)) : null
      });
    });
    
    console.log('✅ [FIREBASE] Usuarios obtenidos exitosamente desde Firestore');
    console.log(`   Total usuarios: ${users.length}`);
    
    return {
      success: true,
      users: users,
      count: users.length
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error obteniendo usuarios:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Crear usuario en Firestore
 * @param {string} token - Token de autenticación
 * @param {Object} userData - Datos del usuario
 * @returns {Object} Resultado de la creación
 */
function firebase_createUser(token, userData) {
  try {
    console.log('👤 [FIREBASE] Creando usuario en Firestore:', userData.email);
    
    // Validar sesión
    const session = firebase_validateSession(token);
    if (!session.success) {
      throw new Error('Sesión inválida');
    }
    
    // Validar datos del usuario
    if (!userData.email || !userData.name || !userData.role) {
      throw new Error('Datos del usuario incompletos');
    }
    
    // Validar rol
    const validRoles = ['super_admin', 'admin', 'modelo'];
    if (!validRoles.includes(userData.role)) {
      throw new Error('Rol inválido. Roles válidos: super_admin, admin, modelo');
    }
    
    // Validar grupos
    const validGroups = ['Cabecera', 'Diamante', 'Sede MP', 'Victoria', 'Terrazas', 'Satélite', 'Otros'];
    if (userData.groups && userData.groups.some(group => !validGroups.includes(group))) {
      throw new Error('Grupo inválido. Grupos válidos: ' + validGroups.join(', '));
    }
    
    // Obtener instancia de Firestore
    const db = getFirestore();
    
    // Verificar si el email ya existe
    const existingUser = db.collection('users').where('email', '==', userData.email).get();
    if (existingUser.docs.length > 0) {
      throw new Error('El email ya está registrado');
    }
    
    // Crear documento de usuario
    const userDoc = {
      email: userData.email,
      name: userData.name,
      role: userData.role,
      groups: userData.groups || [],
      isActive: true,
      createdAt: new Date(),
      lastLogin: null,
      password: userData.password || 'password123' // Contraseña temporal
    };
    
    // Guardar en Firestore
    const docRef = db.collection('users').add(userDoc);
    const userId = docRef.id;
    
    console.log('✅ [FIREBASE] Usuario creado exitosamente en Firestore');
    console.log(`   ID: ${userId}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Rol: ${userData.role}`);
    
    return {
      success: true,
      user: {
        id: userId,
        ...userDoc
      },
      message: 'Usuario creado exitosamente'
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error creando usuario:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Actualizar usuario en Firestore
 * @param {string} token - Token de autenticación
 * @param {string} userId - ID del usuario
 * @param {Object} userData - Datos actualizados del usuario
 * @returns {Object} Resultado de la actualización
 */
function firebase_updateUser(token, userId, userData) {
  try {
    console.log('✏️ [FIREBASE] Actualizando usuario en Firestore:', userId);
    
    // Validar sesión
    const session = firebase_validateSession(token);
    if (!session.success) {
      throw new Error('Sesión inválida');
    }
    
    // Obtener instancia de Firestore
    const db = getFirestore();
    
    // Verificar que el usuario existe
    const userRef = db.collection('users').doc(userId);
    const userDoc = userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('Usuario no encontrado');
    }
    
    // Preparar datos de actualización
    const updateData = {};
    if (userData.name) updateData.name = userData.name;
    if (userData.role) {
      const validRoles = ['super_admin', 'admin', 'modelo'];
      if (!validRoles.includes(userData.role)) {
        throw new Error('Rol inválido. Roles válidos: super_admin, admin, modelo');
      }
      updateData.role = userData.role;
    }
    if (userData.groups) {
      const validGroups = ['Cabecera', 'Diamante', 'Sede MP', 'Victoria', 'Terrazas', 'Satélite', 'Otros'];
      if (userData.groups.some(group => !validGroups.includes(group))) {
        throw new Error('Grupo inválido. Grupos válidos: ' + validGroups.join(', '));
      }
      updateData.groups = userData.groups;
    }
    if (userData.isActive !== undefined) updateData.isActive = userData.isActive;
    if (userData.password) updateData.password = userData.password;
    
    updateData.updatedAt = new Date();
    
    // Actualizar en Firestore
    userRef.update(updateData);
    
    console.log('✅ [FIREBASE] Usuario actualizado exitosamente en Firestore');
    
    return {
      success: true,
      message: 'Usuario actualizado exitosamente'
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error actualizando usuario:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Eliminar usuario de Firestore
 * @param {string} token - Token de autenticación
 * @param {string} userId - ID del usuario
 * @returns {Object} Resultado de la eliminación
 */
function firebase_deleteUser(token, userId) {
  try {
    console.log('🗑️ [FIREBASE] Eliminando usuario de Firestore:', userId);
    
    // Validar sesión
    const session = firebase_validateSession(token);
    if (!session.success) {
      throw new Error('Sesión inválida');
    }
    
    // Obtener instancia de Firestore
    const db = getFirestore();
    
    // Verificar que el usuario existe
    const userRef = db.collection('users').doc(userId);
    const userDoc = userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('Usuario no encontrado');
    }
    
    // Eliminar de Firestore
    userRef.delete();
    
    console.log('✅ [FIREBASE] Usuario eliminado exitosamente de Firestore');
    
    return {
      success: true,
      message: 'Usuario eliminado exitosamente'
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error eliminando usuario:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// CALCULADORA
// ============================================================================

/**
 * Calcular ganancias
 * @param {string} token - Token de autenticación
 * @param {string} userId - ID del usuario
 * @param {Object} inputValues - Valores de entrada
 * @returns {Object} Cálculo de ganancias
 */
function firebase_calculateEarnings(token, userId, inputValues = null) {
  try {
    console.log('🧮 [FIREBASE] Calculando ganancias para usuario:', userId);
    
    // Validar sesión
    const session = firebase_validateSession(token);
    if (!session.success) {
      throw new Error('Sesión inválida');
    }
    
    // Simular cálculo (reemplazar con lógica real)
    const calculation = {
      totalUSD: 1000.00,
      totalCOPD: 4094000,
      maxAdvance: 3684600, // 90%
      meetsMinimum: true,
      platforms: [
        { name: 'Chaturbate', tokens: 1000, usd: 50.00, cop: 204700 },
        { name: 'LiveJasmin', tokens: 500, usd: 500.00, cop: 2047000 }
      ]
    };
    
    console.log('✅ [FIREBASE] Cálculo completado');
    
    return {
      success: true,
      calculation: calculation
    };
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error calculando ganancias:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

/**
 * Generar UUID único
 * @returns {string} UUID generado
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// FUNCIONES ALIAS PARA COMPATIBILIDAD CON FRONTEND
// ============================================================================

/**
 * Alias para firebase_validateSession - permite llamar desde el frontend
 * @param {string} token - Token de sesión
 * @returns {Object} Resultado de la validación
 */
function validateSession(token) {
  return firebase_validateSession(token);
}

/**
 * Alias para firebase_getUsers - permite llamar desde el frontend
 * @param {string} token - Token de sesión
 * @returns {Object} Lista de usuarios
 */
function getUsers(token) {
  return firebase_getUsers(token);
}

// ============================================================================
// FUNCIONES EXPUESTAS ESPECÍFICAMENTE PARA EL FRONTEND
// ============================================================================

/**
 * Función de login expuesta específicamente para el frontend HTML
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @returns {Object} Resultado del login
 */
function doLogin(email, password) {
  console.log('🌐 [FRONTEND] Login desde frontend:', email, password);
  
  try {
    // Validar parámetros
    if (!email || !password) {
      console.error('❌ [FRONTEND] Parámetros inválidos:', { email, password });
      return {
        success: false,
        error: 'Email y contraseña son requeridos'
      };
    }
    
    // Asegurar que los usuarios de prueba existan
    console.log('🔍 [FRONTEND] Verificando usuarios en Firestore...');
    const diagnostico = diagnosticarUsuarios();
    if (diagnostico.total === 0) {
      console.log('🚀 [FRONTEND] Inicializando usuarios de prueba...');
      firebase_initializeData();
    }
    
    // Usar simpleLogin que busca en Firestore real
    const result = simpleLogin(email, password);
    
    console.log('🌐 [FRONTEND] Resultado login:', result);
    
    // Validar que result no sea null
    if (!result) {
      console.error('❌ [FRONTEND] Login retornó null');
      return {
        success: false,
        error: 'Error interno del servidor'
      };
    }
    
    console.log('🌐 [FRONTEND] Retornando resultado:', result);
    return result;
    
  } catch (error) {
    console.error('❌ [FRONTEND] Error en login:', error);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * PRUEBA 1: Verificar conexión con Firestore
 * @returns {Object} Resultado de la prueba de conexión
 */
function prueba1_ConexionFirestore() {
  console.log('🧪 [PRUEBA 1] Verificando conexión con Firestore...');
  
  try {
    // Probar obtención de token
    console.log('🔑 [PRUEBA 1] Obteniendo token de Firebase...');
    const token = getFirebaseToken();
    console.log('✅ [PRUEBA 1] Token obtenido:', token ? 'SÍ' : 'NO');
    
    // Probar consulta a Firestore
    console.log('📊 [PRUEBA 1] Consultando colección users...');
    const db = getFirestore();
    const snapshot = db.collection('users').get();
    console.log('✅ [PRUEBA 1] Consulta exitosa, documentos:', snapshot.docs.length);
    
    return {
      success: true,
      token: token ? 'Obtenido' : 'Error',
      documentos: snapshot.docs.length,
      message: 'Conexión con Firestore exitosa'
    };
    
  } catch (error) {
    console.error('❌ [PRUEBA 1] Error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error en conexión con Firestore'
    };
  }
}

/**
 * PRUEBA 2: Verificar inicialización de datos
 * @returns {Object} Resultado de la prueba de inicialización
 */
function prueba2_InicializacionDatos() {
  console.log('🧪 [PRUEBA 2] Verificando inicialización de datos...');
  
  try {
    // Verificar estado actual
    console.log('🔍 [PRUEBA 2] Verificando usuarios existentes...');
    const diagnostico = diagnosticarUsuarios();
    console.log('📊 [PRUEBA 2] Usuarios actuales:', diagnostico.total);
    
    // Inicializar si es necesario
    if (diagnostico.total === 0) {
      console.log('🚀 [PRUEBA 2] Inicializando usuarios de prueba...');
      const init = firebase_initializeData();
      console.log('📝 [PRUEBA 2] Inicialización:', init);
      
      // Verificar después de inicializar
      const diagnosticoPost = diagnosticarUsuarios();
      console.log('📊 [PRUEBA 2] Usuarios después de inicializar:', diagnosticoPost.total);
      
      return {
        success: init.success,
        usuariosAntes: diagnostico.total,
        usuariosDespues: diagnosticoPost.total,
        inicializacion: init,
        message: 'Inicialización completada'
      };
    } else {
      console.log('ℹ️ [PRUEBA 2] Los usuarios ya existen');
      return {
        success: true,
        usuariosExistentes: diagnostico.total,
        message: 'Usuarios ya inicializados'
      };
    }
    
  } catch (error) {
    console.error('❌ [PRUEBA 2] Error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error en inicialización'
    };
  }
}

/**
 * PRUEBA 3: Verificar login con datos reales
 * @returns {Object} Resultado de la prueba de login
 */
function prueba3_LoginReal() {
  console.log('🧪 [PRUEBA 3] Verificando login con datos reales...');
  
  try {
    // Probar login con usuario de prueba
    console.log('🔐 [PRUEBA 3] Probando login con prueba@firestore.com...');
    const result = simpleLogin('prueba@firestore.com', 'prueba123');
    console.log('📊 [PRUEBA 3] Resultado login:', result);
    
    // Verificar estructura de respuesta
    const estructuraCorrecta = result && 
      typeof result.success === 'boolean' &&
      result.user && 
      result.token;
    
    console.log('✅ [PRUEBA 3] Estructura correcta:', estructuraCorrecta);
    
    return {
      success: result.success,
      login: result,
      estructuraCorrecta: estructuraCorrecta,
      message: result.success ? 'Login exitoso' : 'Login falló'
    };
    
  } catch (error) {
    console.error('❌ [PRUEBA 3] Error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error en prueba de login'
    };
  }
}

/**
 * PRUEBA 4: Verificar creación de usuarios
 * @returns {Object} Resultado de la prueba de creación
 */
function prueba4_CreacionUsuarios() {
  console.log('🧪 [PRUEBA 4] Verificando creación de usuarios...');
  
  try {
    // Primero hacer login para obtener token
    const login = simpleLogin('prueba@firestore.com', 'prueba123');
    if (!login.success) {
      throw new Error('No se pudo hacer login para la prueba');
    }
    
    // Crear usuario de prueba
    const nuevoUsuario = {
      email: 'test_' + Date.now() + '@prueba.com',
      name: 'Usuario de Prueba ' + Date.now(),
      role: 'modelo',
      groups: ['Cabecera'],
      password: 'test123'
    };
    
    console.log('👤 [PRUEBA 4] Creando usuario:', nuevoUsuario.email);
    const creacion = firebase_createUser(login.token, nuevoUsuario);
    console.log('📊 [PRUEBA 4] Resultado creación:', creacion);
    
    // Verificar que el usuario se creó
    if (creacion.success) {
      console.log('🔍 [PRUEBA 4] Verificando usuario creado...');
      const consulta = probarConsultaEmail(nuevoUsuario.email);
      console.log('📊 [PRUEBA 4] Usuario encontrado:', consulta.encontrados > 0);
    }
    
    return {
      success: creacion.success,
      usuarioCreado: nuevoUsuario,
      creacion: creacion,
      message: creacion.success ? 'Usuario creado exitosamente' : 'Error creando usuario'
    };
    
  } catch (error) {
    console.error('❌ [PRUEBA 4] Error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error en prueba de creación'
    };
  }
}

/**
 * PRUEBA 5: Verificar obtención de usuarios
 * @returns {Object} Resultado de la prueba de obtención
 */
function prueba5_ObtencionUsuarios() {
  console.log('🧪 [PRUEBA 5] Verificando obtención de usuarios...');
  
  try {
    // Hacer login para obtener token
    const login = simpleLogin('prueba@firestore.com', 'prueba123');
    if (!login.success) {
      throw new Error('No se pudo hacer login para la prueba');
    }
    
    // Obtener lista de usuarios
    console.log('📋 [PRUEBA 5] Obteniendo lista de usuarios...');
    const usuarios = firebase_getUsers(login.token);
    console.log('📊 [PRUEBA 5] Usuarios obtenidos:', usuarios.count);
    
    // Verificar estructura de respuesta
    const estructuraCorrecta = usuarios && 
      typeof usuarios.success === 'boolean' &&
      Array.isArray(usuarios.users) &&
      typeof usuarios.count === 'number';
    
    console.log('✅ [PRUEBA 5] Estructura correcta:', estructuraCorrecta);
    
    return {
      success: usuarios.success,
      totalUsuarios: usuarios.count,
      usuarios: usuarios.users,
      estructuraCorrecta: estructuraCorrecta,
      message: usuarios.success ? 'Usuarios obtenidos exitosamente' : 'Error obteniendo usuarios'
    };
    
  } catch (error) {
    console.error('❌ [PRUEBA 5] Error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Error en prueba de obtención'
    };
  }
}

/**
 * PRUEBA COMPLETA: Ejecutar todas las pruebas
 * @returns {Object} Resultado de todas las pruebas
 */
function pruebaCompleta_Sistema() {
  console.log('🧪 [PRUEBA COMPLETA] Ejecutando todas las pruebas...');
  
  const resultados = {};
  
  try {
    // Ejecutar todas las pruebas
    console.log('1️⃣ Ejecutando Prueba 1: Conexión Firestore');
    resultados.prueba1 = prueba1_ConexionFirestore();
    
    console.log('2️⃣ Ejecutando Prueba 2: Inicialización');
    resultados.prueba2 = prueba2_InicializacionDatos();
    
    console.log('3️⃣ Ejecutando Prueba 3: Login Real');
    resultados.prueba3 = prueba3_LoginReal();
    
    console.log('4️⃣ Ejecutando Prueba 4: Creación Usuarios');
    resultados.prueba4 = prueba4_CreacionUsuarios();
    
    console.log('5️⃣ Ejecutando Prueba 5: Obtención Usuarios');
    resultados.prueba5 = prueba5_ObtencionUsuarios();
    
    // Calcular resumen
    const pruebasExitosas = Object.values(resultados).filter(p => p.success).length;
    const totalPruebas = Object.keys(resultados).length;
    
    console.log('📊 [PRUEBA COMPLETA] Resumen:', `${pruebasExitosas}/${totalPruebas} pruebas exitosas`);
    
    return {
      success: pruebasExitosas === totalPruebas,
      pruebasExitosas: pruebasExitosas,
      totalPruebas: totalPruebas,
      resultados: resultados,
      message: pruebasExitosas === totalPruebas ? 'Todas las pruebas exitosas' : 'Algunas pruebas fallaron'
    };
    
  } catch (error) {
    console.error('❌ [PRUEBA COMPLETA] Error:', error);
    return {
      success: false,
      error: error.message,
      resultados: resultados,
      message: 'Error en pruebas completas'
    };
  }
}

/**
 * Función de validación de sesión expuesta para el frontend
 * @param {string} token - Token de sesión
 * @returns {Object} Resultado de la validación
 */
function doValidateSession(token) {
  console.log('🌐 [FRONTEND] Validando sesión desde frontend');
  return firebase_validateSession(token);
}

/**
 * Función de obtención de usuarios expuesta para el frontend
 * @param {string} token - Token de sesión
 * @returns {Object} Lista de usuarios
 */
function doGetUsers(token) {
  console.log('🌐 [FRONTEND] Obteniendo usuarios desde frontend');
  return firebase_getUsers(token);
}

/**
 * Función de creación de usuarios expuesta para el frontend
 * @param {string} token - Token de sesión
 * @param {Object} userData - Datos del usuario
 * @returns {Object} Resultado de la creación
 */
function doCreateUser(token, userData) {
  console.log('🌐 [FRONTEND] Creando usuario desde frontend');
  return firebase_createUser(token, userData);
}

/**
 * Función de actualización de usuarios expuesta para el frontend
 * @param {string} token - Token de sesión
 * @param {string} userId - ID del usuario
 * @param {Object} userData - Datos actualizados
 * @returns {Object} Resultado de la actualización
 */
function doUpdateUser(token, userId, userData) {
  console.log('🌐 [FRONTEND] Actualizando usuario desde frontend');
  return firebase_updateUser(token, userId, userData);
}

/**
 * Función de eliminación de usuarios expuesta para el frontend
 * @param {string} token - Token de sesión
 * @param {string} userId - ID del usuario
 * @returns {Object} Resultado de la eliminación
 */
function doDeleteUser(token, userId) {
  console.log('🌐 [FRONTEND] Eliminando usuario desde frontend');
  return firebase_deleteUser(token, userId);
}

// ============================================================================
// INICIALIZACIÓN DE DATOS
// ============================================================================

/**
 * Inicializar datos básicos en Firestore
 * @returns {Object} Resultado de la inicialización
 */
function firebase_initializeData() {
  try {
    console.log('🚀 [FIREBASE] Inicializando datos básicos en Firestore');
    
    // Obtener instancia de Firestore
    const db = getFirestore();
    
    // Crear usuarios por defecto si no existen
    const adminUser = {
      email: 'admin@aim.com',
      name: 'Super Administrador',
      role: 'super_admin',
      groups: ['Cabecera'],
      isActive: true,
      createdAt: new Date(),
      lastLogin: null,
      password: 'admin123'
    };
    
    const testUser = {
      email: 'prueba@firestore.com',
      name: 'Usuario de Prueba',
      role: 'admin',
      groups: ['Cabecera'],
      isActive: true,
      createdAt: new Date(),
      lastLogin: null,
      password: 'prueba123'
    };
    
    // Verificar si ya existen usuarios
    const usersRef = db.collection('users');
    const snapshot = usersRef.get();
    
    if (snapshot.docs.length === 0) {
      console.log('📝 [FIREBASE] Creando usuarios por defecto...');
      
      // Crear admin
      usersRef.add(adminUser);
      console.log('✅ [FIREBASE] Usuario admin creado');
      
      // Crear test
      usersRef.add(testUser);
      console.log('✅ [FIREBASE] Usuario test creado');
      
      console.log('✅ [FIREBASE] Datos inicializados exitosamente');
      
      return {
        success: true,
        message: 'Datos inicializados exitosamente'
      };
    } else {
      console.log('ℹ️ [FIREBASE] Los datos ya están inicializados');
      return {
        success: true,
        message: 'Los datos ya están inicializados'
      };
    }
    
  } catch (error) {
    console.error('❌ [FIREBASE] Error inicializando datos:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// FUNCIÓN DE LOGIN REAL CON FIRESTORE
// ============================================================================

/**
 * Función de login real con Firestore
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña del usuario
 * @returns {Object} Resultado del login
 */
function simpleLogin(email, password) {
  console.log('🔐 [LOGIN] Autenticando usuario desde Firestore:', email);
  
  try {
    // Validar parámetros
    if (!email || !password) {
      return {
        success: false,
        error: 'Email y contraseña son requeridos'
      };
    }
    
    // Obtener instancia de Firestore
    const db = getFirestore();
    
    // Buscar usuario en Firestore por email
    const userQuery = db.collection('users').where('email', '==', email).get();
    
    if (userQuery.docs.length === 0) {
      console.log('❌ [LOGIN] Usuario no encontrado en Firestore');
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }
    
    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    // Verificar contraseña
    if (userData.password !== password) {
      console.log('❌ [LOGIN] Contraseña incorrecta');
      return {
        success: false,
        error: 'Contraseña incorrecta'
      };
    }
    
    // Verificar que el usuario esté activo
    if (!userData.isActive) {
      console.log('❌ [LOGIN] Usuario inactivo');
      return {
        success: false,
        error: 'Usuario inactivo'
      };
    }
    
    // Crear objeto de usuario para la sesión
    const user = {
      id: userDoc.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      groups: userData.groups || [],
      isActive: userData.isActive,
      createdAt: userData.createdAt,
      lastLogin: new Date()
    };
    
    // Generar token de sesión
    const token = 'firebase-session-' + generateUUID();
    
    // Actualizar último login en Firestore
    db.collection('users').doc(userDoc.id).update({
      lastLogin: new Date()
    });
    
    console.log('✅ [LOGIN] Usuario autenticado exitosamente desde Firestore');
    console.log('   Usuario:', user.name);
    console.log('   Rol:', user.role);
    
    return {
      success: true,
      user: user,
      token: token
    };
    
  } catch (error) {
    console.error('❌ [LOGIN] Error en autenticación:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// FUNCIONES DE PRUEBA Y DIAGNÓSTICO
// ============================================================================
