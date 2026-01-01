# 🚨 INSTRUCCIONES: Archivar P2 de Diciembre - EMERGENCIA

**Fecha:** 31 de Diciembre 2025  
**Objetivo:** Archivar los valores por plataforma del período 16-31 de diciembre que aún están en las calculadoras

---

## ✅ SITUACIÓN ACTUAL

- ✅ Los datos están en `model_values` en producción
- ✅ Las calculadoras de las modelos muestran los valores
- ❌ Los datos NO están archivados en `calculator_history`
- ⚠️ Necesitamos archivarlos ANTES de que se pierdan

## ⏰ IMPORTANTE: Límite de Tiempo

**El script solo archiva valores registrados hasta las 23:59:59 del último día del período.**

- **Período 16-31 de Diciembre:** Solo valores hasta `2025-12-31 23:59:59`
- **Valores registrados después de las 23:59:59 NO se archivan** (pertenecen al siguiente período)
- Esto asegura que solo se archiven los valores que realmente pertenecen al período cerrado

---

## 🔧 OPCIÓN 1: Ejecutar Script Localmente (Si tienes acceso a producción)

### **Requisitos:**
1. Tener `.env.local` configurado con credenciales de **PRODUCCIÓN**
2. Tener Node.js instalado
3. Tener acceso a la base de datos de producción

### **Pasos:**

1. **Verificar que estás conectado a producción:**
   ```bash
   node scripts/verificar_valores_produccion.js
   ```
   
   Debe mostrar valores encontrados. Si muestra 0, verifica las credenciales.

2. **Ejecutar el archivado:**
   ```bash
   node scripts/archivar_p2_diciembre_emergencia.js
   ```

3. **Verificar resultados:**
   - El script mostrará cuántos modelos se archivaron
   - Generará un reporte JSON con los resultados
   - Verificará que los datos están en `calculator_history`

---

## 🔧 OPCIÓN 2: Ejecutar desde Vercel (Recomendado)

### **Crear Endpoint API de Emergencia:**

He creado el script `scripts/archivar_p2_diciembre_emergencia.js` que puedes convertir en un endpoint API.

### **Pasos:**

1. **Crear endpoint en producción:**
   - Crear archivo: `app/api/admin/emergency-archive-p2/route.ts`
   - Copiar la lógica del script
   - Agregar autenticación de admin

2. **Ejecutar desde el navegador o Postman:**
   ```bash
   POST https://tu-dominio.com/api/admin/emergency-archive-p2
   Authorization: Bearer [ADMIN_TOKEN]
   ```

---

## 🔧 OPCIÓN 3: Ejecutar SQL Directo (Si tienes acceso a Supabase)

### **PASO 1: Verificar que hay valores**

```sql
-- Verificar valores en el período
SELECT 
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as modelos,
  COUNT(DISTINCT platform_id) as plataformas,
  MIN(period_date) as fecha_min,
  MAX(period_date) as fecha_max
FROM model_values
WHERE period_date >= '2025-12-16'
  AND period_date <= '2025-12-31';
```

### **PASO 2: Archivar manualmente (NO RECOMENDADO - Solo si es absolutamente necesario)**

**⚠️ ADVERTENCIA:** Esto requiere conocimiento avanzado de SQL y las fórmulas de cálculo. Es mejor usar el script.

---

## 📋 VERIFICACIÓN POST-ARCHIVADO

### **1. Verificar en calculator_history:**

```sql
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  COUNT(DISTINCT platform_id) as plataformas
FROM calculator_history
WHERE period_date = '2025-12-16'
  AND period_type = '16-31';
```

**Resultado esperado:**
- ✅ Múltiples registros (uno por cada plataforma de cada modelo)
- ✅ Cada registro tiene `platform_id` diferente
- ✅ Cada registro tiene valores calculados completos

### **2. Verificar que no quedan valores residuales:**

```sql
SELECT COUNT(*) as residuales
FROM model_values
WHERE period_date >= '2025-12-16'
  AND period_date <= '2025-12-31';
```

**Resultado esperado:**
- ✅ 0 valores residuales

### **3. Verificar "Mi Historial":**

- Ir a "Mi Calculadora" → "Mi Historial"
- Debe mostrar el período 16-31 de diciembre
- Debe mostrar valores por plataforma

---

## ⚠️ IMPORTANTE

### **ANTES de ejecutar:**

1. ✅ **Hacer backup** de `model_values` para el período
2. ✅ **Verificar credenciales** de producción
3. ✅ **Confirmar que los datos están** en `model_values`

### **DURANTE la ejecución:**

1. ✅ **Monitorear los logs** del script
2. ✅ **Verificar que cada modelo se archiva** correctamente
3. ✅ **No interrumpir** el proceso

### **DESPUÉS de ejecutar:**

1. ✅ **Verificar en calculator_history** que los datos están
2. ✅ **Verificar que no quedan residuales** en `model_values`
3. ✅ **Probar "Mi Historial"** para confirmar que funciona

---

## 🚨 SI ALGO SALE MAL

### **Si el script falla a mitad de camino:**

1. **NO entrar en pánico**
2. **Revisar los logs** para identificar qué modelo falló
3. **Los modelos ya archivados están seguros** en `calculator_history`
4. **Re-ejecutar solo para los modelos que fallaron**

### **Si se pierden datos:**

1. **Los datos ya archivados están en `calculator_history`**
2. **Solo se pierden los datos de modelos que no se archivaron**
3. **Revisar logs para identificar la causa**

---

## 📝 NOTAS

- El script archiva **SOLO si puede verificar** que se insertó correctamente
- El script **NO elimina** valores si el archivado falla
- El script genera **reportes detallados** de todo el proceso
- El script es **seguro** y **conservador**

---

**Estado:** 🚨 **EMERGENCIA - Archivar Inmediatamente**  
**Prioridad:** 🔴 **MÁXIMA**

