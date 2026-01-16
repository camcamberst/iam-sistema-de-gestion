# 🚨 ACCIÓN INMEDIATA: Valores Residuales Detectados

**Fecha:** 31 de Diciembre 2025  
**Problema:** Se detectaron valores residuales en `model_values` para 24 modelos después del cierre de período

---

## ⚠️ SITUACIÓN ACTUAL

### **Datos Detectados:**

- **24 modelos** tienen valores residuales en `model_values` para el período 16-31 de Diciembre 2025
- **Total de valores residuales:** ~1,500+ registros
- **Rango de valores por modelo:** 1 a 194 valores residuales

### **Modelos Afectados:**

```
668e5799-1a78-4980-a33b-52674328bb33: 48 valores
379957fd-560c-4986-ab3a-45c3d2738e55: 56 valores
b305dcac-760d-4512-bd11-e493063a8d97: 69 valores
... (21 más)
```

---

## 🔍 ANÁLISIS DEL PROBLEMA

### **Posibles Causas:**

1. **El proceso de eliminación falló después del archivado**
   - Los valores fueron archivados correctamente
   - Pero la eliminación de `model_values` falló o se interrumpió

2. **El proceso se ejecutó parcialmente**
   - Algunos modelos se procesaron correctamente
   - Otros modelos no se procesaron o fallaron

3. **Error en el rango de fechas**
   - El proceso eliminó valores de un rango incorrecto
   - Los valores residuales están fuera del rango procesado

---

## ✅ PLAN DE ACCIÓN

### **PASO 1: Verificar Estado de Archivado**

**Objetivo:** Confirmar si los valores están archivados en `calculator_history`

**Script:**
```bash
node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
```

**O manualmente en Supabase:**
```sql
-- Verificar si hay registros archivados para estos modelos
SELECT 
  model_id,
  COUNT(*) as registros_archivados,
  COUNT(DISTINCT platform_id) as plataformas_archivadas
FROM calculator_history
WHERE period_date = '2025-12-16'
  AND period_type = '16-31'
  AND model_id IN (
    '668e5799-1a78-4980-a33b-52674328bb33',
    '379957fd-560c-4986-ab3a-45c3d2738e55',
    'b305dcac-760d-4512-bd11-e493063a8d97'
    -- ... agregar todos los IDs
  )
GROUP BY model_id;
```

---

### **PASO 2: Eliminar Valores Residuales (Solo si están archivados)**

**Objetivo:** Limpiar valores residuales de modelos que YA tienen archivo completo

**Script:**
```bash
node scripts/eliminar_residuales_si_archivados.js 2025-12-16 16-31
```

**Este script:**
- ✅ Verifica que cada modelo tiene archivo en `calculator_history`
- ✅ Elimina valores residuales SOLO de modelos con archivo completo
- ✅ NO elimina valores de modelos sin archivo (requieren archivado primero)
- ✅ Genera reporte detallado

---

### **PASO 3: Archivar Modelos Sin Archivo (Si los hay)**

**Objetivo:** Archivar valores de modelos que NO tienen archivo en `calculator_history`

**Opciones:**

#### **Opción A: Usar Endpoint API (Recomendado)**

```bash
# Para cada modelo sin archivo, llamar al endpoint
curl -X POST "https://tu-dominio.com/api/calculator/period-closure/close-period" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [SERVICE_KEY]" \
  -d '{
    "period_date": "2025-12-16",
    "period_type": "16-31",
    "model_id": "[MODEL_ID]",
    "bypass_guardrails": false
  }'
```

#### **Opción B: Script Manual (Requiere TypeScript)**

Crear un script que use `atomicArchiveAndReset` para cada modelo específico.

#### **Opción C: Contactar al Equipo de Desarrollo**

Si hay muchos modelos sin archivo, puede ser más eficiente que el equipo lo haga.

---

## 🔒 SEGURIDAD

### **Reglas Críticas:**

1. ✅ **NUNCA eliminar valores sin verificar que están archivados**
2. ✅ **Siempre verificar archivo antes de eliminar**
3. ✅ **Mantener backups en `calc_snapshots`**
4. ✅ **Documentar todas las acciones**

---

## 📋 CHECKLIST DE EJECUCIÓN

### **Antes de Ejecutar:**

- [ ] Verificar que tienes acceso a Supabase con service role key
- [ ] Verificar que el script puede conectarse a Supabase
- [ ] Hacer backup de `model_values` para el período (opcional pero recomendado)
- [ ] Confirmar el período correcto: `2025-12-16` / `16-31`

### **Ejecución:**

- [ ] Ejecutar script de verificación: `node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31`
- [ ] Revisar reporte y confirmar qué modelos tienen archivo
- [ ] Ejecutar script de eliminación: `node scripts/eliminar_residuales_si_archivados.js 2025-12-16 16-31`
- [ ] Revisar reporte final y verificar que no quedan valores residuales

### **Después de Ejecutar:**

- [ ] Verificar en Supabase que no quedan valores residuales
- [ ] Verificar que "Mi Historial" muestra los datos correctamente
- [ ] Documentar resultados en este archivo

---

## 📊 RESULTADOS ESPERADOS

### **Después de la Corrección:**

1. ✅ **Todos los modelos con archivo:** Valores residuales eliminados
2. ✅ **Todos los modelos sin archivo:** Valores archivados primero, luego eliminados
3. ✅ **Verificación final:** 0 valores residuales en `model_values` para el período
4. ✅ **"Mi Historial":** Muestra todos los períodos correctamente

---

## 🚨 SI ALGO SALE MAL

### **Si se eliminan valores sin archivar:**

1. **NO entrar en pánico**
2. **Verificar backups en `calc_snapshots`**
3. **Contactar al equipo de desarrollo inmediatamente**
4. **NO intentar restaurar manualmente sin supervisión**

### **Si el script falla:**

1. **Revisar logs del script**
2. **Verificar conexión a Supabase**
3. **Verificar permisos de service role key**
4. **Contactar al equipo si el problema persiste**

---

## 📝 NOTAS

- Los scripts están diseñados para ser **seguros** y **conservadores**
- Solo eliminan valores si están archivados
- Generan reportes detallados de todas las acciones
- No modifican datos sin verificación previa

---

**Fecha del Reporte:** 31 de Diciembre 2025  
**Estado:** ⚠️ **ACCIÓN REQUERIDA - Valores Residuales Detectados**







