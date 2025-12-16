# 🔄 QUÉ PASARÁ EN EL CIERRE COMPLETO DEL PERÍODO

**Fecha del Cierre:** Día 16, 00:00 Colombia  
**Período a Cerrar:** 1-15 (del mes actual)  
**Nuevo Período que Inicia:** 16-31 (del mes actual)

---

## ⏰ TIMELINE DEL CIERRE COMPLETO

### 00:00:00 Colombia (Día 16)

El cron job `/api/cron/period-closure-full-close` se ejecuta automáticamente.

---

## 📋 PROCESO PASO A PASO

### FASE 1: Verificación y Preparación (00:00:00 - 00:00:01)

1. ✅ Verifica que es día de cierre (16)
2. ✅ Verifica que es 00:00 Colombia (ventana 00:00-00:15)
3. ✅ Determina el período a cerrar:
   - **Período a cerrar:** 1-15 (del mes actual)
   - **Nuevo período:** 16-31 (del mes actual)
4. ✅ Verifica si el período ya fue cerrado (si ya está en `completed`, retorna sin hacer nada)
5. ✅ Marca estado: `closing_calculators` en `calculator_period_closure_status`

---

### FASE 2: Archivar y Resetear (00:00:01 - 00:02:00)

**Para cada modelo activo (aproximadamente 30 modelos):**

#### 2.1. ARCHIVAR (Operación Atómica)
- ✅ Lee todos los valores de `model_values` del período 1-15
- ✅ Calcula totales para cada plataforma:
  - Convierte valores a USD bruto según moneda y reglas especiales
  - Aplica porcentaje del modelo
  - Calcula COP modelo
- ✅ Inserta en `calculator_history` con:
  - `period_date`: Fecha del día 16 (o día 1 del período)
  - `period_type`: '1-15'
  - `value_usd_bruto`, `value_usd_modelo`, `value_cop_modelo`
  - `platform_id`, `model_id`, `value` (valor original)
- ✅ **Incluye TODAS las plataformas** (no solo las 10 especiales)
  - Las 10 especiales ya estaban congeladas desde ayer
  - Las demás plataformas se archivan ahora

#### 2.2. RESETEAR (Operación Atómica - Misma Transacción)
- ✅ Elimina todos los valores de `model_values` del período 1-15
- ✅ **Las calculadoras quedan en 0.00** para todas las plataformas
- ✅ El modelo puede comenzar a ingresar valores para el nuevo período (16-31)

**Importante:** Archivar y resetear ocurren en una **transacción atómica**, es decir:
- Si el archivo falla, NO se resetea
- Si el reset falla, NO se archiva
- Solo se completa si ambas operaciones son exitosas

---

### FASE 3: Esperar Actualización del Resumen (00:02:00 - 00:04:30)

- ✅ Marca estado: `waiting_summary`
- ✅ **Espera 2.5 minutos (150 segundos)**
- ✅ **Razón:** Dar tiempo a que "Resumen de Facturación" reciba la última actualización de `calculator_totals`
- ✅ Durante este tiempo, el resumen puede seguir leyendo de `calculator_totals` (período aún técnicamente activo)

---

### FASE 4: Resumen se Actualiza Automáticamente (00:04:30)

- ✅ Marca estado: `closing_summary`
- ✅ **El "Resumen de Facturación" NO necesita hacer nada especial**
- ✅ Automáticamente detecta que el período está cerrado (fecha > día 15)
- ✅ Cambia su fuente de datos:
  - **Antes:** `calculator_totals` (período activo)
  - **Después:** `calculator_history` (período cerrado)
- ✅ Muestra datos archivados del período 1-15
- ✅ Disponible en "Consulta Histórica" del Dashboard de Sedes

---

### FASE 5: Notificaciones (00:04:30 - 00:05:00)

#### 5.1. Notificaciones a Modelos
- ✅ Para cada modelo (30 modelos):
  - Envía notificación vía AIM Botty:
    ```
    "El período ha cerrado. Tus valores han sido archivados y puedes 
    revisarlos en 'Mi Historial'. La calculadora se ha reiniciado para 
    el nuevo período. Puedes comenzar a ingresar valores nuevamente."
    ```

#### 5.2. Notificaciones a Admins/Super Admins
- ✅ Para cada admin/super_admin:
  - Envía notificación vía AIM Botty:
    ```
    "Período 1-15 (2025-12-16) cerrado exitosamente. El resumen está 
    disponible en 'Consulta Histórica' del Dashboard de Sedes. 
    Nuevo período 16-31 (2025-12-16) iniciado."
    ```

---

### FASE 6: Completar (00:05:00)

- ✅ Marca estado: `completed` en `calculator_period_closure_status`
- ✅ Registra:
  - Total de modelos procesados
  - Exitosos vs fallidos
  - Tiempo de finalización
  - Resultados detallados

---

## 📊 ESTADO DE LAS TABLAS DESPUÉS DEL CIERRE

### Antes del Cierre (Día 15, 23:59):
- ✅ `model_values` - Contiene valores del período 1-15
- ✅ `calculator_totals` - Contiene totales consolidados del período 1-15
- ✅ `calculator_history` - Contiene períodos anteriores (si los hay)
- ✅ `calculator_early_frozen_platforms` - Contiene las 10 plataformas especiales congeladas

### Después del Cierre (Día 16, 00:05+):
- ✅ `model_values` - **VACÍO** (reseteado para todas las plataformas)
- ✅ `calculator_totals` - **VACÍO o desactualizado** (no se usa para períodos cerrados)
- ✅ `calculator_history` - **Contiene datos archivados** del período 1-15 (TODAS las plataformas)
- ✅ `calculator_early_frozen_platforms` - **Se limpia** (ya no es necesario, período cerrado)
- ✅ `calculator_period_closure_status` - Estado `completed` para período 1-15

---

## 🎯 QUÉ VERÁN LOS USUARIOS

### Modelos:
1. **"Mi Calculadora":**
   - ✅ Todas las plataformas en **0.00**
   - ✅ Pueden comenzar a ingresar valores para el nuevo período (16-31)
   - ✅ Las 10 plataformas especiales ya NO están congeladas (período nuevo)

2. **"Mi Historial":**
   - ✅ Pueden ver el período 1-15 cerrado
   - ✅ Valores archivados de todas sus plataformas
   - ✅ Totales calculados (USD bruto, USD modelo, COP modelo)

### Admins/Super Admins:
1. **"Resumen de Facturación":**
   - ✅ Automáticamente muestra datos del período 1-15 (cerrado)
   - ✅ Lee de `calculator_history` en lugar de `calculator_totals`
   - ✅ Datos congelados (no cambian)

2. **"Consulta Histórica":**
   - ✅ Pueden consultar el período 1-15
   - ✅ Ver datos consolidados por modelo/sede
   - ✅ Exportar o revisar detalles

---

## ⚠️ PUNTOS IMPORTANTES

### 1. Operación Atómica
- ✅ Archivar y resetear ocurren en una sola transacción
- ✅ Si falla, NO se pierden datos
- ✅ Garantiza consistencia de datos

### 2. Todas las Plataformas
- ✅ El cierre completo afecta a **TODAS las plataformas**
- ✅ No solo las 10 especiales (esas ya estaban congeladas)
- ✅ Incluye todas las plataformas que el modelo tenga habilitadas

### 3. Nuevo Período Inicia Inmediatamente
- ✅ Después del cierre, el nuevo período (16-31) está activo
- ✅ Los modelos pueden comenzar a ingresar valores inmediatamente
- ✅ Las 10 plataformas especiales NO están congeladas en el nuevo período (hasta el próximo día 15)

### 4. Resumen Automático
- ✅ El "Resumen de Facturación" detecta automáticamente el cambio
- ✅ No requiere intervención manual
- ✅ Cambia de `calculator_totals` → `calculator_history` automáticamente

---

## 📈 RESUMEN EJECUTIVO

**En el cierre completo (día 16, 00:00 Colombia):**

1. ✅ Se archivan valores de **TODAS las plataformas** del período 1-15
2. ✅ Se resetean calculadoras (todas en 0.00)
3. ✅ Se espera 2.5 minutos para actualización del resumen
4. ✅ El resumen cambia automáticamente a leer datos históricos
5. ✅ Se notifican modelos y admins
6. ✅ Se marca el proceso como completado
7. ✅ Nuevo período 16-31 inicia inmediatamente

**Tiempo total estimado:** ~5 minutos (00:00 - 00:05)

---

**Última actualización:** Día 15, 19:00 Colombia (después de ejecutar Early Freeze)

