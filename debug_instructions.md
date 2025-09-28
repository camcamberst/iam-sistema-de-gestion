# 🔍 SISTEMA DE DEBUG AVANZADO - INSTRUCCIONES

## 🎯 OBJETIVO
Capturar el problema exacto en la gestión de usuarios paso a paso, sin perseguir fantasmas en el código.

## 📋 INSTRUCCIONES DE USO

### 1. 🔧 INSTALAR DEBUG EN EL NAVEGADOR

**Paso 1:** Abrir la consola del navegador (F12)
**Paso 2:** Copiar y pegar el contenido de `debug_api_routes.js`
**Paso 3:** Presionar Enter para ejecutar

```javascript
// El script se ejecutará automáticamente y mostrará:
// - Estado de autenticación
// - Estado de la aplicación
// - Interceptación de llamadas API
// - Debug de base de datos
```

### 2. 🧪 EJECUTAR TESTS DE API

**En la consola del navegador, ejecutar:**
```javascript
// Test manual de API routes
fetch('/api/users')
  .then(response => {
    console.log('Status:', response.status);
    return response.text();
  })
  .then(data => console.log('Data:', data))
  .catch(error => console.error('Error:', error));

fetch('/api/groups')
  .then(response => {
    console.log('Status:', response.status);
    return response.text();
  })
  .then(data => console.log('Data:', data))
  .catch(error => console.error('Error:', error));
```

### 3. 📊 MONITOR DE ERRORES EN TIEMPO REAL

**El script incluye un monitor que captura:**
- Errores de JavaScript
- Errores de Promise
- Errores de fetch
- Errores de red

**Para ver errores capturados:**
```javascript
// Ver todos los errores
errorMonitor.getErrors();

// Limpiar errores
errorMonitor.clearErrors();
```

### 4. 🔍 DEBUG PASO A PASO

**Para debuggear manualmente:**
```javascript
// Debug de autenticación
debugAuth();

// Debug de estado de la app
debugAppState();

// Debug de base de datos
debugDatabase();

// Debug completo
startDebug();
```

## 📋 CHECKLIST DE DEBUG

### ✅ ANTES DE EMPEZAR
- [ ] Consola del navegador abierta
- [ ] Script de debug cargado
- [ ] Usuario logueado como super_admin

### ✅ DURANTE LA NAVEGACIÓN
- [ ] Ir a Gestión de Usuarios
- [ ] Observar logs en consola
- [ ] Capturar errores específicos
- [ ] Verificar llamadas API

### ✅ DESPUÉS DE CAPTURAR ERRORES
- [ ] Copiar logs completos
- [ ] Identificar error específico
- [ ] Verificar si es problema de:
  - Autenticación
  - Base de datos
  - API routes
  - Frontend

## 🎯 RESULTADOS ESPERADOS

El sistema de debug te mostrará:

1. **🔐 Estado de Autenticación:**
   - Token válido
   - Session activa
   - Permisos correctos

2. **🌐 Llamadas API:**
   - URL exacta llamada
   - Headers enviados
   - Respuesta recibida
   - Errores específicos

3. **🗄️ Estado de Base de Datos:**
   - Conexión exitosa
   - Datos retornados
   - Errores de consulta

4. **📱 Estado de la Aplicación:**
   - Ruta actual
   - Elementos del DOM
   - Errores visibles

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### Error 500 en /api/users
- **Verificar:** Logs de autenticación
- **Verificar:** Conexión a Supabase
- **Verificar:** Permisos de usuario

### Error 500 en /api/groups
- **Verificar:** Tabla groups existe
- **Verificar:** Políticas RLS
- **Verificar:** Relaciones de datos

### Error de autenticación
- **Verificar:** Token válido
- **Verificar:** Session activa
- **Verificar:** Permisos de rol

## 📞 SOPORTE

Si el debug no muestra información suficiente:

1. **Ejecutar debug completo:**
   ```javascript
   startDebug();
   ```

2. **Verificar errores capturados:**
   ```javascript
   errorMonitor.getErrors();
   ```

3. **Test manual de API:**
   ```javascript
   // Ejecutar tests individuales
   fetch('/api/users').then(r => r.text()).then(console.log);
   fetch('/api/groups').then(r => r.text()).then(console.log);
   ```

## 🎯 PRÓXIMOS PASOS

Una vez que tengas los logs del debug:

1. **Identificar el error específico**
2. **Localizar la causa raíz**
3. **Aplicar la solución correcta**
4. **Verificar que funciona**

---

**¡Con este sistema de debug podrás capturar exactamente qué está fallando y dónde!** 🔍✨
