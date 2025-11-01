# 🧪 Guía de Testing: Nuevo Sistema de Cierre de Períodos

## 📋 Pre-requisitos

1. ✅ Tablas creadas en Supabase (ya ejecutado)
2. ✅ Proyecto corriendo en desarrollo o producción
3. ✅ Acceso a la consola del navegador o herramienta de API (Postman/curl)

---

## 🔍 Verificación Inicial

### 1. Verificar que las tablas existen

Ejecuta en Supabase SQL Editor:
```sql
-- Verificar tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'calculator_period_closure_status',
    'calculator_early_frozen_platforms'
  );

-- Verificar estructura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'calculator_period_closure_status';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'calculator_early_frozen_platforms';
```

---

## 🧪 Testing de Endpoints

### 1. Verificar Estado Actual

**Endpoint:** `GET /api/calculator/period-closure/check-status`

**Desde el navegador (consola):**
```javascript
fetch('/api/calculator/period-closure/check-status')
  .then(r => r.json())
  .then(console.log);
```

**Desde terminal (curl):**
```bash
curl http://localhost:3000/api/calculator/period-closure/check-status
```

**Resultado esperado:**
```json
{
  "success": true,
  "period_date": "2025-01-31",
  "period_type": "16-31",
  "status": null,
  "is_closing": false
}
```

---

### 2. Verificar Estado de Plataformas Congeladas

**Endpoint:** `GET /api/calculator/period-closure/platform-freeze-status?modelId=TU_MODEL_ID`

**Reemplaza `TU_MODEL_ID` con un ID real de modelo**

**Desde el navegador (consola):**
```javascript
const modelId = 'TU_MODEL_ID_AQUI'; // Reemplaza con ID real
fetch(`/api/calculator/period-closure/platform-freeze-status?modelId=${modelId}`)
  .then(r => r.json())
  .then(console.log);
```

**Resultado esperado:**
```json
{
  "success": true,
  "model_id": "...",
  "period_date": "2025-01-31",
  "frozen_platforms": [],
  "is_frozen": false
}
```

---

### 3. Probar Congelación Anticipada (Early Freeze)

**⚠️ NOTA:** Este endpoint solo funciona si es medianoche Europa Central. Para testing, puedes:

**Opción A: Modificar temporalmente la validación**

En `utils/period-closure-dates.ts`, función `isEarlyFreezeTime()`, comentar temporalmente:
```typescript
export const isEarlyFreezeTime = (): boolean => {
  // TEMPORAL PARA TESTING: siempre retorna true
  return true; // <-- Cambiar temporalmente
  
  // Código original comentado...
};
```

**Endpoint:** `POST /api/calculator/period-closure/early-freeze`

**Desde el navegador (consola):**
```javascript
fetch('/api/calculator/period-closure/early-freeze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
  .then(r => r.json())
  .then(console.log);
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Congelación anticipada completada",
  "period_date": "2025-01-31",
  "period_type": "16-31",
  "results": {
    "total_models": 10,
    "successful": 10,
    "failed": 0
  },
  "frozen_platforms": [
    "superfoon",
    "livecreator",
    "mdh",
    "777",
    "xmodels",
    "big7",
    "mondo",
    "vx",
    "babestation",
    "dirtyfans"
  ]
}
```

**Verificar en Supabase:**
```sql
-- Ver plataformas congeladas
SELECT * FROM calculator_early_frozen_platforms 
WHERE period_date = CURRENT_DATE
ORDER BY frozen_at DESC;

-- Ver estado del cierre
SELECT * FROM calculator_period_closure_status 
WHERE period_date = CURRENT_DATE
ORDER BY created_at DESC;
```

---

### 4. Probar Cierre Completo (Close Period)

**⚠️ NOTA:** Este endpoint solo funciona si es día 1 o 16 y 00:00 Colombia. Para testing:

**Opción A: Modificar temporalmente las validaciones**

En `utils/period-closure-dates.ts`:
```typescript
export const isClosureDay = (): boolean => {
  return true; // <-- Cambiar temporalmente para testing
  // Código original...
};

export const isFullClosureTime = (): boolean => {
  return true; // <-- Cambiar temporalmente para testing
  // Código original...
};
```

**⚠️ IMPORTANTE:** Este endpoint espera 150 segundos (2.5 minutos). Puedes reducir temporalmente:

En `app/api/calculator/period-closure/close-period/route.ts`, línea ~120:
```typescript
// TEMPORAL PARA TESTING: 5 segundos en lugar de 150
await new Promise(resolve => setTimeout(resolve, 5000)); // Cambiar de 150000 a 5000
```

**Endpoint:** `POST /api/calculator/period-closure/close-period`

**Desde el navegador (consola):**
```javascript
fetch('/api/calculator/period-closure/close-period', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
  .then(r => r.json())
  .then(console.log);
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Cierre de período completado exitosamente",
  "period_date": "2025-01-31",
  "period_type": "16-31",
  "archive_summary": {
    "total": 10,
    "successful": 10,
    "failed": 0
  },
  "reset_summary": {
    "total": 10,
    "successful": 10,
    "failed": 0
  }
}
```

**Verificar en Supabase:**
```sql
-- Ver valores archivados
SELECT * FROM calculator_history 
WHERE period_date = CURRENT_DATE
ORDER BY archived_at DESC
LIMIT 20;

-- Ver que model_values fueron eliminados (del período actual)
SELECT COUNT(*) FROM model_values 
WHERE period_date = CURRENT_DATE;
-- Debe ser 0 o muy bajo

-- Ver estado final
SELECT * FROM calculator_period_closure_status 
WHERE period_date = CURRENT_DATE
ORDER BY created_at DESC;
-- status debe ser 'completed'
```

---

### 5. Probar Cierre Manual (Recuperación)

**Endpoint:** `POST /api/calculator/period-closure/manual-close`

**Requisitos:**
- Debes estar autenticado como admin o super_admin
- Obtener tu token de sesión

**Desde el navegador (consola - si tienes sesión activa):**
```javascript
// Obtener token desde localStorage o cookie de sesión
const token = 'TU_TOKEN_AQUI'; // Obtener de la sesión actual

fetch('/api/calculator/period-closure/manual-close', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    periodDate: '2025-01-31',
    targetStatus: 'pending',
    force: true
  })
})
  .then(r => r.json())
  .then(console.log);
```

---

## 🔄 Testing de Cron Jobs

### 1. Probar Cron Early Freeze

**Endpoint:** `GET /api/cron/period-closure-early-freeze`

**Desde terminal:**
```bash
curl http://localhost:3000/api/cron/period-closure-early-freeze
```

**Resultado esperado si NO es momento:**
```json
{
  "success": true,
  "message": "No es momento de congelación anticipada..."
}
```

**Para forzar ejecución**, modifica temporalmente `isEarlyFreezeTime()` como se indicó arriba.

---

### 2. Probar Cron Full Close

**Endpoint:** `GET /api/cron/period-closure-full-close`

**Desde terminal:**
```bash
curl http://localhost:3000/api/cron/period-closure-full-close
```

---

## ✅ Checklist de Verificación

### Funcionalidades Básicas
- [ ] Endpoint `check-status` retorna estado actual
- [ ] Endpoint `platform-freeze-status` retorna plataformas congeladas
- [ ] Early freeze congela las 10 plataformas especiales
- [ ] Las plataformas congeladas aparecen en la tabla `calculator_early_frozen_platforms`
- [ ] Close period archiva valores a `calculator_history`
- [ ] Close period elimina valores de `model_values` del período
- [ ] Close period notifica a modelos y admins vía AIM Botty
- [ ] Estado se actualiza correctamente en `calculator_period_closure_status`

### Verificaciones en Base de Datos
- [ ] Tabla `calculator_period_closure_status` tiene registros
- [ ] Tabla `calculator_early_frozen_platforms` tiene registros cuando se congela
- [ ] Tabla `calculator_history` tiene valores archivados después del cierre
- [ ] Tabla `model_values` está vacía del período después del cierre

### Notificaciones
- [ ] Las modelos reciben notificación de AIM Botty sobre congelación
- [ ] Las modelos reciben notificación de AIM Botty sobre cierre completo
- [ ] Los admins reciben notificación de AIM Botty sobre cierre exitoso

---

## 🐛 Troubleshooting

### Error: "Table does not exist"
- Verifica que ejecutaste el SQL en Supabase
- Verifica que estás en el proyecto correcto

### Error: "No es momento de..."
- Modifica temporalmente las funciones de validación para testing
- **IMPORTANTE:** Revierte los cambios después de testing

### Error: "Token inválido" en manual-close
- Asegúrate de estar autenticado
- Obtén el token correcto de tu sesión

### El cierre no notifica
- Verifica que AIM Botty existe en la base de datos
- Verifica que las modelos tienen conversación con Botty creada
- Revisa logs del servidor

---

## 🔄 Revertir Cambios de Testing

Después de testing, **revierte los cambios temporales**:

1. En `utils/period-closure-dates.ts`:
   - Restaurar `isEarlyFreezeTime()` a validación real
   - Restaurar `isClosureDay()` a validación real
   - Restaurar `isFullClosureTime()` a validación real

2. En `app/api/calculator/period-closure/close-period/route.ts`:
   - Restaurar tiempo de espera a 150000ms (150 segundos)

---

## 📝 Notas Importantes

- **NO probar en producción** sin revisar cuidadosamente
- **Siempre revertir cambios temporales** después de testing
- Los cron jobs se ejecutarán automáticamente los días 1 y 16
- Para testing en días diferentes, usa los endpoints directamente con validaciones temporales desactivadas

