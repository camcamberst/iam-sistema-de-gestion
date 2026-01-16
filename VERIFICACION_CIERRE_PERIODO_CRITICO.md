# 🔒 VERIFICACIÓN CRÍTICA: Cierre de Período y Archivado

**Fecha:** 31 de Diciembre 2025  
**Objetivo:** Asegurar que los valores por plataforma se archiven ANTES de resetear las calculadoras

---

## ⚠️ PROBLEMA REPORTADO

El cierre de período solo se ejecutó correctamente en el "Resumen de Facturación", pero necesitamos verificar:
1. ✅ ¿Se creó el registro histórico en "Mi Historial" de "Mi Calculadora"?
2. ✅ ¿Los valores por plataforma quedaron archivados ANTES de poner las calculadoras en 0?

---

## 🔍 ANÁLISIS DEL ORDEN DE OPERACIONES

### **Función: `atomicArchiveAndReset()`**

**Archivo:** `lib/calculator/period-closure-helpers.ts`  
**Líneas:** 205-435

#### **ORDEN ACTUAL (CORRECTO):**

1. **PASO 1-5:** Obtener y consolidar valores por plataforma (líneas 265-287)
2. **PASO 6:** Preparar registros históricos con cálculos (líneas 289-313)
3. **PASO 7:** **ARCHIVAR en `calculator_history`** (líneas 315-396)
   - ✅ Inserta registros por plataforma
   - ✅ **VALIDACIÓN CRÍTICA:** Verifica que se insertaron todos los registros
   - ✅ **VALIDACIÓN ADICIONAL:** Verifica que todas las plataformas están presentes
   - ✅ **VALIDACIÓN DE INTEGRIDAD:** Verifica que todos los campos están completos
   - ✅ **SI ALGUNA VALIDACIÓN FALLA:** Lanza error y NO continúa
4. **PASO 8:** **ELIMINAR de `model_values`** (líneas 400-417)
   - ✅ Solo se ejecuta si el archivado fue exitoso
   - ✅ Si hay error en el archivado, NO se ejecuta

---

## ✅ CONFIRMACIÓN: El Orden es Correcto

### **Código Clave:**

```typescript
// PASO 7: ARCHIVAR (líneas 315-396)
if (historyInserts.length > 0) {
  // Insertar en calculator_history
  const { error: historyError } = await supabase
    .from('calculator_history')
    .upsert(historyInserts, { ... });

  if (historyError) {
    console.error(`❌ [ATOMIC-CLOSE] Error archivando en history:`, historyError);
    throw historyError; // ⚠️ DETIENE EL PROCESO AQUÍ
  }

  // VALIDACIONES (líneas 349-395)
  // Si alguna validación falla, lanza error y NO continúa
  if (verifiedCount < historyInserts.length) {
    throw new Error(`Validación fallida: ...`); // ⚠️ DETIENE EL PROCESO
  }
  
  if (verifiedPlatforms.size !== expectedPlatforms.size) {
    throw new Error(`Validación fallida: ...`); // ⚠️ DETIENE EL PROCESO
  }
  
  if (incompleteRecords.length > 0) {
    throw new Error(`Validación fallida: ...`); // ⚠️ DETIENE EL PROCESO
  }
}

// PASO 8: ELIMINAR (líneas 400-417)
// Solo se ejecuta si el archivado fue exitoso
console.log(`🗑️ [ATOMIC-CLOSE] Eliminando valores...`);
const { data: deletedData, error: deleteError } = await supabase
  .from('model_values')
  .delete()
  .eq('model_id', modelId)
  .gte('period_date', startDate)
  .lte('period_date', endDate)
  .select();
```

**✅ CONFIRMADO:** El proceso archiva PRIMERO y solo elimina DESPUÉS si el archivado fue exitoso.

---

## 🔍 VERIFICACIÓN POST-CIERRE

### **Script de Verificación Automática**

**Archivo:** `scripts/verificar_archivado_cierre_periodo.js`

**Uso:**
```bash
node scripts/verificar_archivado_cierre_periodo.js [period_date] [period_type]
```

**Ejemplo:**
```bash
node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
```

**El script verifica:**
1. ✅ Si hay registros en `calculator_history` para cada modelo
2. ✅ Si hay valores residuales en `model_values` (no deberían existir)
3. ✅ Si el archivo tiene detalle por plataforma
4. ✅ Si todos los campos calculados están completos

---

### **Verificación Manual en Supabase**

#### **1. Verificar Registros en `calculator_history`:**

```sql
-- Verificar que hay registros archivados para el período
SELECT 
  model_id,
  COUNT(*) as registros_archivados,
  COUNT(DISTINCT platform_id) as plataformas_archivadas,
  period_date,
  period_type
FROM calculator_history
WHERE period_date = '2025-12-16'
  AND period_type = '16-31'
GROUP BY model_id, period_date, period_type
ORDER BY model_id;
```

**Resultado esperado:**
- ✅ Múltiples registros por modelo (uno por cada plataforma)
- ✅ Cada registro tiene `platform_id` diferente
- ✅ Cada registro tiene `value`, `value_usd_bruto`, `value_usd_modelo`, `value_cop_modelo`

---

#### **2. Verificar Valores Residuales en `model_values`:**

```sql
-- Verificar que NO hay valores residuales en model_values
SELECT 
  model_id,
  COUNT(*) as valores_residuales,
  COUNT(DISTINCT platform_id) as plataformas_con_valores
FROM model_values
WHERE period_date >= '2025-12-16'
  AND period_date <= '2025-12-31'
GROUP BY model_id
ORDER BY model_id;
```

**Resultado esperado:**
- ✅ **0 registros** (o solo valores del nuevo período si ya se ingresaron)

---

#### **3. Verificar Detalle por Plataforma:**

```sql
-- Verificar que cada modelo tiene detalle por plataforma
SELECT 
  ch.model_id,
  u.email,
  ch.platform_id,
  ch.value,
  ch.value_usd_bruto,
  ch.value_usd_modelo,
  ch.value_cop_modelo,
  ch.period_date,
  ch.period_type
FROM calculator_history ch
LEFT JOIN users u ON ch.model_id = u.id
WHERE ch.period_date = '2025-12-16'
  AND ch.period_type = '16-31'
ORDER BY ch.model_id, ch.platform_id;
```

**Resultado esperado:**
- ✅ Múltiples filas por modelo (una por cada plataforma)
- ✅ Cada fila tiene `platform_id` diferente
- ✅ Cada fila tiene valores calculados completos

---

#### **4. Verificar "Mi Historial" (API):**

**Endpoint:** `/api/model/calculator/historial?modelId=[MODEL_ID]`

**Verificación:**
```bash
curl -X GET "https://tu-dominio.com/api/model/calculator/historial?modelId=[MODEL_ID]" \
  -H "Authorization: Bearer [TOKEN]"
```

**Resultado esperado:**
```json
{
  "success": true,
  "periods": [
    {
      "period_date": "2025-12-16",
      "period_type": "16-31",
      "platforms": [
        {
          "platform_id": "chaturbate",
          "platform_name": "Chaturbate",
          "value": 1000,
          "value_usd_bruto": 50,
          "value_usd_modelo": 40,
          "value_cop_modelo": 156000
        },
        {
          "platform_id": "onlyfans",
          "platform_name": "OnlyFans",
          "value": 2000,
          "value_usd_bruto": 2000,
          "value_usd_modelo": 1600,
          "value_cop_modelo": 6240000
        }
        // ... más plataformas
      ],
      "total_value": 3000,
      "total_usd_bruto": 2050,
      "total_usd_modelo": 1640,
      "total_cop_modelo": 6396000
    }
  ],
  "total_periods": 1
}
```

**✅ CONFIRMADO:** Si el archivo está completo, "Mi Historial" mostrará los datos con detalle por plataforma.

---

## ⚠️ POSIBLES PROBLEMAS Y SOLUCIONES

### **Problema 1: No hay registros en `calculator_history`**

**Causa posible:**
- El proceso de archivado falló silenciosamente
- Las validaciones no detectaron el error
- El proceso se ejecutó pero no insertó los registros

**Solución:**
1. Verificar logs de Vercel para el momento del cierre
2. Buscar errores en `calculator_period_closure_status`
3. Verificar si hay backups en `calc_snapshots`

---

### **Problema 2: Hay valores residuales en `model_values`**

**Causa posible:**
- El proceso de eliminación falló después del archivado
- El proceso se interrumpió antes de completar

**Solución:**
1. Verificar que el archivado fue exitoso (registros en `calculator_history`)
2. Si el archivado fue exitoso, ejecutar eliminación manual:
   ```sql
   DELETE FROM model_values
   WHERE period_date >= '2025-12-16'
     AND period_date <= '2025-12-31';
   ```

---

### **Problema 3: El archivo tiene totales pero no detalle por plataforma**

**Causa posible:**
- El proceso de archivado consolidó valores en lugar de guardar por plataforma
- Error en la lógica de agrupación

**Solución:**
1. Verificar que cada registro tiene `platform_id` único
2. Verificar que no hay registros con `platform_id = '_consolidated'` (esto sería un error)
3. Si hay registros consolidados, restaurar desde `calc_snapshots`

---

## 🔒 GARANTÍAS DEL SISTEMA

### **Validaciones Implementadas:**

1. ✅ **Verificación de inserción:** Confirma que se insertaron todos los registros
2. ✅ **Verificación de plataformas:** Confirma que todas las plataformas están presentes
3. ✅ **Verificación de integridad:** Confirma que todos los campos están completos
4. ✅ **Logs detallados:** Registra todas las plataformas archivadas

### **Si alguna validación falla:**

- ❌ **El proceso se DETIENE**
- ❌ **Se lanza un error**
- ❌ **NO se eliminan los valores de `model_values`**
- ❌ **NO se marca el período como cerrado**

---

## 📋 CHECKLIST DE VERIFICACIÓN INMEDIATA

### **Para el Período 16-31 de Diciembre 2025:**

- [ ] Ejecutar script de verificación: `node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31`
- [ ] Verificar en Supabase que hay registros en `calculator_history` para el período
- [ ] Verificar que NO hay valores residuales en `model_values` para el período
- [ ] Verificar que cada modelo tiene múltiples registros (uno por plataforma)
- [ ] Verificar que "Mi Historial" muestra los datos correctamente
- [ ] Verificar logs de Vercel para el momento del cierre

---

## 🚨 ACCIÓN INMEDIATA REQUERIDA

**Si el script de verificación detecta problemas:**

1. **NO resetear manualmente las calculadoras** hasta confirmar que el archivo está completo
2. **Revisar logs de Vercel** para identificar el error
3. **Verificar backups en `calc_snapshots`** para restaurar si es necesario
4. **Contactar al equipo de desarrollo** si el problema persiste

---

**Fecha del Reporte:** 31 de Diciembre 2025  
**Estado:** ⚠️ **VERIFICACIÓN REQUERIDA**







