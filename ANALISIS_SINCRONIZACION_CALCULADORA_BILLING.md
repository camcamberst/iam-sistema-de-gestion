# 📊 Análisis de Sincronización: Mi Calculadora ↔ Resumen de Facturación

**Fecha de Análisis:** Enero 2025  
**Componentes Analizados:**
- `app/admin/model/calculator/page.tsx` (Mi Calculadora)
- `components/BillingSummary.tsx` (Resumen de Facturación)
- `app/api/calculator/totals/route.ts` (API de Totales)
- `app/api/admin/billing-summary/route.ts` (API de Resumen)

---

## 🔄 FLUJO DE DATOS ACTUAL

### 1. **Flujo de Escritura (Mi Calculadora → Base de Datos)**

```
Usuario ingresa valores en Mi Calculadora
    ↓
saveValues() ejecuta:
    1. POST /api/calculator/model-values-v2
       → Guarda valores individuales en model_values
    2. POST /api/calculator/totals
       → Guarda totales consolidados en calculator_totals
```

**Código relevante:**
```782:939:app/admin/model/calculator/page.tsx
const saveValues = async () => {
  // ... guarda valores individuales ...
  
  // 2. Calcular y guardar totales consolidados
  const totalsResponse = await fetch('/api/calculator/totals', {
    method: 'POST',
    body: JSON.stringify({
      modelId: user?.id,
      periodDate: currentPeriodDate,
      totalUsdBruto,
      totalUsdModelo,
      totalCopModelo
    })
  });
}
```

### 2. **Flujo de Lectura (Base de Datos → Resumen de Facturación)**

```
BillingSummary carga datos:
    ↓
loadBillingData() ejecuta:
    GET /api/admin/billing-summary?adminId=...&periodDate=...
       → Lee de calculator_totals (período activo)
       → Lee de calculator_history (período cerrado)
```

**Código relevante:**
```116:232:components/BillingSummary.tsx
const loadBillingData = async (silent = false) => {
  // ... calcula targetDate según selectedPeriod ...
  
  const response = await fetch(`/api/admin/billing-summary?${params}&_t=${Date.now()}`);
  // ... procesa respuesta ...
}
```

---

## ⚠️ PROBLEMAS IDENTIFICADOS

### **PROBLEMA #1: Inconsistencia en Normalización de Fechas**

**Ubicación:** Múltiples archivos

**Descripción:**
- **Mi Calculadora** usa `getColombiaPeriodStartDate()` para determinar `periodDate` al guardar
- **API `/api/calculator/totals`** IGNORA el `periodDate` recibido y siempre usa `getColombiaDate()` (fecha actual)
- **Resumen de Facturación** calcula el rango de quincena basado en `periodDate` recibido

**Código problemático:**

```76:77:app/api/calculator/totals/route.ts
// Normalizar la fecha al día actual en Colombia (evita desajustes por zona horaria)
const periodDateCo = getColombiaDate();
```

**Impacto:**
- Si un modelo guarda valores el día 20, pero el sistema determina que estamos en el período 16-31, el `periodDate` debería ser `2025-01-16`
- Sin embargo, la API de totales guarda con `getColombiaDate()` que podría ser `2025-01-20`
- Esto causa que los datos se guarden en un "bucket" diferente al esperado

**Evidencia:**
```805:806:app/admin/model/calculator/page.tsx
const currentPeriodDate = getColombiaPeriodStartDate();
const payload = { modelId: user?.id, values, periodDate: currentPeriodDate };
```
El frontend envía `periodDate` normalizado, pero el backend lo ignora.

---

### **PROBLEMA #2: Cálculo de Totales Inconsistente**

**Ubicación:** `app/admin/model/calculator/page.tsx` líneas 825-900

**Descripción:**
Los totales se calculan en el frontend usando fórmulas específicas por plataforma, pero:
1. El cálculo se hace en el cliente (puede tener errores de redondeo)
2. No hay validación de que los totales calculados coincidan con los valores individuales guardados
3. Si falla el guardado de totales, el guardado de valores individuales ya se completó (no hay rollback)

**Código relevante:**
```825:923:app/admin/model/calculator/page.tsx
// 2. Calcular y guardar totales consolidados
console.log('🔍 [CALCULATOR] Calculating totals for billing summary...');

// Calcular totales usando la misma lógica que se muestra en "Totales y Alertas"
const totalUsdBruto = platforms.reduce((sum, p) => {
  // ... fórmulas específicas por plataforma ...
}, 0);

// ... más cálculos ...

const totalsResponse = await fetch('/api/calculator/totals', {
  method: 'POST',
  body: JSON.stringify({
    modelId: user?.id,
    periodDate: currentPeriodDate,
    totalUsdBruto,
    totalUsdModelo,
    totalCopModelo
  })
});

const totalsData = await totalsResponse.json();
if (!totalsData.success) {
  console.error('❌ [CALCULATOR] Error saving totals:', totalsData.error);
  // No fallar la operación principal, solo loggear el error
}
```

**Impacto:**
- Si el cálculo de totales falla silenciosamente, el Resumen de Facturación mostrará datos desactualizados
- No hay garantía de que los totales reflejen los valores individuales más recientes

---

### **PROBLEMA #3: Polling y Actualización Automática**

**Ubicación:** `components/BillingSummary.tsx` líneas 234-246

**Descripción:**
El Resumen de Facturación usa polling cada 15 segundos para actualizar datos, pero:
1. No hay sincronización bidireccional: si Mi Calculadora guarda, no hay notificación inmediata
2. El polling puede causar múltiples requests innecesarios
3. No hay indicador visual claro de cuándo los datos están desactualizados

**Código relevante:**
```234:246:components/BillingSummary.tsx
const { isPolling, isSilentUpdating, manualRefresh } = useBillingPolling(
  loadBillingData,
  [selectedDate, selectedSede, userId],
  {
    refreshInterval: 15000, // 15 segundos
    enabled: true,
    silentUpdate: true,
    onRefresh: () => {
      console.log('🔄 [BILLING-SUMMARY] Datos actualizados automáticamente');
    }
  }
);
```

**Impacto:**
- Puede haber un delay de hasta 15 segundos antes de ver cambios reflejados
- Si múltiples modelos guardan simultáneamente, el polling puede no capturar todos los cambios

---

### **PROBLEMA #4: Manejo de Períodos Activos vs Cerrados**

**Ubicación:** `app/api/admin/billing-summary/route.ts` líneas 275-300

**Descripción:**
El sistema determina si un período está activo o cerrado, pero:
1. La lógica de determinación puede no coincidir entre Mi Calculadora y Resumen de Facturación
2. Durante el cierre (días 1 y 16 a las 00:00 Colombia), puede haber una ventana donde:
   - Mi Calculadora aún guarda en `calculator_totals`
   - Resumen de Facturación ya está leyendo de `calculator_history`
3. No hay sincronización de estado entre ambos componentes

**Código relevante:**
```255:300:app/api/admin/billing-summary/route.ts
// Determinar si el período está activo según hoy dentro del rango (usar hora Colombia)
const todayStr = getColombiaDate();
const isActivePeriod = todayStr >= quinStartStr && todayStr <= quinEndStr;

if (isActivePeriod) {
  // Período activo: usar EXCLUSIVAMENTE calculator_totals
  const { data: totals, error: totalsError } = await supabase
    .from('calculator_totals')
    .select('*')
    .in('model_id', modelIds)
    .gte('period_date', startStr)
    .lte('period_date', endStr)
```

**Impacto:**
- Durante transiciones de período, puede haber datos inconsistentes
- Un modelo puede ver sus datos en Mi Calculadora, pero el admin no los ve en Resumen de Facturación

---

### **PROBLEMA #5: Falta de Validación de Sincronización**

**Ubicación:** No existe

**Descripción:**
No hay mecanismo para:
1. Verificar que los totales en `calculator_totals` coincidan con la suma de valores en `model_values`
2. Detectar y corregir inconsistencias automáticamente
3. Alertar al usuario cuando hay desincronización

**Impacto:**
- Errores silenciosos pueden acumularse sin detección
- Los usuarios pueden ver datos diferentes sin saber por qué

---

### **PROBLEMA #6: Race Conditions en Guardado**

**Ubicación:** `app/admin/model/calculator/page.tsx` líneas 782-939

**Descripción:**
El proceso de guardado tiene dos pasos secuenciales:
1. Guardar valores individuales (`model_values`)
2. Guardar totales (`calculator_totals`)

Si hay múltiples guardados simultáneos:
- El segundo guardado puede sobrescribir los totales del primero
- No hay locks o transacciones que prevengan esto

**Código relevante:**
```782:939:app/admin/model/calculator/page.tsx
const saveValues = async () => {
  // 1. Guardar valores individuales por plataforma
  const response = await fetch('/api/calculator/model-values-v2', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  
  // 2. Calcular y guardar totales consolidados
  const totalsResponse = await fetch('/api/calculator/totals', {
    method: 'POST',
    body: JSON.stringify({...})
  });
}
```

**Impacto:**
- Si dos modelos guardan al mismo tiempo, los totales pueden reflejar solo uno de los guardados
- El Resumen de Facturación puede mostrar datos parciales

---

## 🔍 ANÁLISIS DE SINCRONIZACIÓN DE FECHAS

### **Inconsistencia en Normalización**

**Mi Calculadora:**
- Usa `getColombiaPeriodStartDate()` que retorna `YYYY-MM-01` o `YYYY-MM-16`
- Envía este valor normalizado al backend

**API de Totales:**
- Recibe `periodDate` pero lo ignora
- Usa `getColombiaDate()` que retorna la fecha actual completa (ej: `2025-01-20`)

**Resumen de Facturación:**
- Calcula rango de quincena basado en `periodDate` recibido
- Busca en `calculator_totals` usando `gte('period_date', startStr).lte('period_date', endStr)`

**Problema:**
Si un modelo guarda el día 20:
- Frontend envía: `periodDate: "2025-01-16"` (normalizado)
- Backend guarda: `period_date: "2025-01-20"` (fecha actual)
- Resumen busca: `period_date >= "2025-01-16" AND period_date <= "2025-01-31"`
- ✅ Encuentra el registro (porque 20 está en el rango)

**PERO:** Si el modelo guarda el día 1:
- Frontend envía: `periodDate: "2025-01-01"` (normalizado)
- Backend guarda: `period_date: "2025-01-01"` (fecha actual, coincide por casualidad)
- ✅ Funciona

**PERO:** Si el modelo guarda el día 2:
- Frontend envía: `periodDate: "2025-01-01"` (normalizado)
- Backend guarda: `period_date: "2025-01-02"` (fecha actual)
- ✅ Funciona (2 está en rango 1-15)

**Conclusión:** Aunque funciona en la mayoría de casos, hay una inconsistencia conceptual que puede causar problemas en edge cases.

---

## 📋 RESUMEN DE HALLAZGOS

### **Críticos (Pueden causar pérdida de datos o inconsistencias):**
1. ❌ **API de totales ignora periodDate recibido** - Usa fecha actual en lugar de normalizada
2. ❌ **Falta de transacciones** - Guardado de valores y totales no es atómico
3. ❌ **Race conditions** - Múltiples guardados simultáneos pueden sobrescribirse

### **Importantes (Pueden causar confusión o datos desactualizados):**
4. ⚠️ **Cálculo de totales en frontend** - Puede tener errores de redondeo
5. ⚠️ **Polling de 15 segundos** - Delay en actualización de datos
6. ⚠️ **Falta de validación** - No hay verificación de consistencia

### **Menores (Mejoras de UX):**
7. 💡 **Falta de notificación inmediata** - No hay sincronización bidireccional
8. 💡 **Indicadores de estado** - No está claro cuándo los datos están desactualizados

---

## 🎯 RECOMENDACIONES (Sin Implementar)

### **Prioridad Alta:**
1. **Corregir normalización de fechas en API de totales:**
   - Usar `normalizeToPeriodStartDate(periodDate)` en lugar de `getColombiaDate()`
   - Asegurar que siempre se guarde con la fecha de inicio de período

2. **Implementar transacciones o validación:**
   - Verificar que los totales coincidan con la suma de valores individuales
   - Implementar rollback si falla el guardado de totales

3. **Prevenir race conditions:**
   - Usar locks o versionado optimista en `calculator_totals`
   - O calcular totales en el backend basándose en `model_values`

### **Prioridad Media:**
4. **Mover cálculo de totales al backend:**
   - Calcular totales desde `model_values` en lugar de recibirlos del frontend
   - Garantizar consistencia matemática

5. **Implementar sincronización bidireccional:**
   - Usar WebSockets o Server-Sent Events para notificar cambios inmediatos
   - O reducir polling a 5 segundos durante horas activas

6. **Agregar validación de consistencia:**
   - Endpoint de diagnóstico que compare `calculator_totals` vs suma de `model_values`
   - Ejecutar periódicamente y alertar si hay inconsistencias

### **Prioridad Baja:**
7. Mejorar UX de indicadores:**
   - Mostrar timestamp de última actualización
   - Indicador visual cuando los datos están desactualizados
   - Botón de "Forzar actualización" más prominente

---

## 📝 NOTAS ADICIONALES

- El sistema tiene mecanismos de "reconstrucción de emergencia" que intentan recuperar datos desde `calculator_totals` si `calculator_history` está vacío
- Hay múltiples endpoints de sincronización (`/api/calculator/sync-missing-totals`, `/api/calculator/recalculate-totals`) que sugieren que se han encontrado problemas de sincronización anteriormente
- El código tiene muchos logs de debugging, lo que indica que ha habido problemas de sincronización en el pasado

---

**Fin del Análisis**

