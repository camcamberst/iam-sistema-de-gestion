# ⏰ LÍNEA DE TIEMPO DETALLADA: CIERRE DE PERÍODO

## 📅 CONTEXTO GENERAL

El sistema maneja **dos períodos mensuales**:
- **P1 (1-15)**: Del día 1 al 15 de cada mes
- **P2 (16-31)**: Del día 16 al último día del mes

Cada período se cierra en dos momentos diferentes:
1. **Early Freeze**: Congelación anticipada de 10 plataformas especiales
2. **Full Close**: Cierre completo de todas las plataformas

---

## 🔄 FLUJO COMPLETO DEL CIERRE

### 📍 ESCENARIO 1: CIERRE DEL PERÍODO 1-15 (Día 16)

#### **DÍA 15 - CONGELACIÓN ANTICIPADA (Early Freeze)**

**⏰ Hora:** ~18:00-19:00 Colombia (medianoche Europa Central)

**🎯 Objetivo:** Congelar las 10 plataformas especiales antes del cierre completo

**📋 Proceso paso a paso:**

1. **00:00:00 - Verificación del Cron Job**
   - El cron `/api/cron/period-closure-early-freeze` se ejecuta cada hora desde las 17:00 hasta las 07:00 del día siguiente
   - Verifica que es día 15 (o 31) usando `isEarlyFreezeRelevantDay()`
   - Verifica que es medianoche Europa Central usando `isEarlyFreezeTime()`
   - Si ambas condiciones se cumplen, llama al endpoint `/api/calculator/period-closure/early-freeze`

2. **00:00:01 - Inicio del Early Freeze**
   - Estado en `calculator_period_closure_status`: `early_freezing`
   - Verifica que no se haya ejecutado ya hoy (evita duplicados)
   - Obtiene todos los modelos activos (`role = 'modelo'` y `is_active = true`)

3. **00:00:02 - Congelación por Modelo**
   - Para cada modelo (aproximadamente 30 modelos):
     - Inserta registros en `calculator_early_frozen_platforms` con:
       - `period_date`: Fecha actual (día 15)
       - `model_id`: ID del modelo
       - `platform_id`: Cada una de las 10 plataformas especiales:
         - `superfoon`, `livecreator`, `mdh`, `777`, `xmodels`, `big7`, `mondo`, `vx`, `babestation`, `dirtyfans`
       - `frozen_at`: Timestamp actual
     - Envía notificación vía AIM Botty al modelo:
       > "Las plataformas especiales han sido bloqueadas para edición. El período está cerrado para estas plataformas."

4. **00:00:30 - Finalización del Early Freeze**
   - Estado actualizado a: `closing_calculators`
   - Registra metadata con:
     - `models_processed`: Total de modelos
     - `success_count`: Modelos procesados exitosamente
     - `error_count`: Modelos con errores
   - Las 10 plataformas especiales quedan **bloqueadas** en "Mi Calculadora"
   - Las demás plataformas siguen **habilitadas** para ingresar valores

**📊 Estado de las Tablas:**
- ✅ `calculator_early_frozen_platforms`: Contiene ~300 registros (30 modelos × 10 plataformas)
- ✅ `calculator_period_closure_status`: Estado `closing_calculators` para el día 15
- ✅ `model_values`: Sin cambios (valores siguen activos)
- ✅ `calculator_history`: Vacío (aún no se archiva)

---

#### **DÍA 16 - CIERRE COMPLETO (Full Close)**

**⏰ Hora:** 00:00:00 Colombia (ventana: 00:00-00:15)

**🎯 Objetivo:** Archivar todos los valores y resetear las calculadoras para el nuevo período

**📋 Proceso paso a paso:**

##### **FASE 1: Verificación y Preparación (00:00:00 - 00:00:01)**

1. **00:00:00 - Ejecución del Cron Job**
   - El cron `/api/cron/period-closure-full-close` se ejecuta a las 05:00 UTC (00:00 Colombia)
   - Verifica que es día 16 (o día 1) usando `isClosureDay()`
   - Verifica que es medianoche Colombia usando `isFullClosureTime()` (ventana 00:00-00:15)
   - Llama al endpoint `/api/calculator/period-closure/close-period`

2. **00:00:01 - Determinación del Período**
   - Calcula el período a cerrar:
     - **Período a cerrar:** 1-15 del mes actual (ej: `2025-12-01` con `period_type: '1-15'`)
     - **Nuevo período:** 16-31 del mes actual (ej: `2025-12-16` con `period_type: '16-31'`)
   - Verifica si el período ya fue cerrado (`status = 'completed'`)
     - Si ya está cerrado, retorna sin hacer nada (a menos que sea ejecución forzada)

3. **00:00:02 - Actualización de Estado**
   - Estado en `calculator_period_closure_status`: `closing_calculators`
   - Obtiene todos los modelos activos

---

##### **FASE 1.5: CREAR BACKUP DE SEGURIDAD (00:00:02 - 00:00:10)**

**✅ ESTADO ACTUAL: IMPLEMENTADO**

**🎯 Objetivo:** Crear un snapshot completo de `model_values` ANTES de iniciar el archivado, para garantizar recuperación en caso de fallo.

**📋 Proceso ejecutado:**

3. **00:00:02 - Crear Backup de Seguridad**
   - **Tabla objetivo:** `calc_snapshots`
   - Para cada modelo activo:
     - Lee todos los valores de `model_values` del período a cerrar (rango completo del período)
     - Obtiene las tasas activas en ese momento (`rates` con `active = true`)
     - Obtiene la configuración del modelo (`calculator_config`)
     - Crea un registro en `calc_snapshots` con:
       - `model_id`: ID del modelo
       - `period_id`: UUID determinístico generado desde `period_date + period_type + model_id`
       - `totals_json`: JSON con:
         - `period_date`, `period_type`, `period_start`, `period_end`
         - `values`: Array completo de todos los valores por plataforma
         - `total_platforms`: Cantidad de plataformas con valores
         - `total_value`: Suma total de valores
         - `snapshot_metadata`: Información del backup
       - `rates_applied_json`: JSON con:
         - `rates`: Array completo de tasas activas
         - `model_config`: Configuración del modelo
         - `snapshot_timestamp`: Timestamp del backup
         - `period_reference`: Referencia única del período
   - **Propósito:** Si el archivado falla, los datos pueden recuperarse completamente desde `calc_snapshots`
   - **Estado actual:** ✅ **IMPLEMENTADO** - Se ejecuta automáticamente antes del archivado

**🔍 Mecanismos de Seguridad Implementados:**

- ✅ **Backup Explícito:** Snapshot completo antes del archivado en `calc_snapshots`
- ✅ **Operación Atómica:** Archivar y resetear ocurren en la misma función, si falla el archivo, NO se borra `model_values`
- ✅ **Validación de Archivo:** Verifica que los registros se insertaron correctamente antes de continuar
- ✅ **Umbral de Errores:** Si más del 10% falla, detiene el proceso completo sin borrar datos
- ✅ **Recuperación:** Los datos pueden restaurarse desde `calc_snapshots` si es necesario

**💡 Ventajas del Backup Implementado:**

- **Recuperación Completa:** Si el archivado falla, los datos pueden restaurarse desde `calc_snapshots`
- **Punto de Restauración Conocido:** Estado exacto de los datos antes del cierre
- **Auditoría:** Historial completo del estado antes de cada cierre
- **Seguridad Adicional:** Capa extra de protección más allá de las validaciones

---

##### **FASE 2: Archivar y Resetear (00:00:10 - 00:02:00)**

**🔒 OPERACIÓN ATÓMICA:** Cada modelo se procesa de forma atómica (archivar + resetear en una transacción)

4. **00:00:10 - Procesamiento por Modelo (Bucle)**

   Para cada modelo activo:

   **4.1. ARCHIVAR (Operación Atómica)**
   - Lee todos los valores de `model_values` del período 1-15:
     ```sql
     SELECT * FROM model_values 
     WHERE model_id = ? 
     AND period_date = '2025-12-01' 
     AND value > 0
     ```
   - Para cada plataforma con valores:
     - Calcula `value_usd_bruto` según:
       - Moneda de la plataforma (USD, EUR, COP, tokens)
       - Reglas especiales (tokens, porcentajes, etc.)
     - Calcula `value_usd_modelo`:
       - Aplica porcentaje del modelo desde `model_configurations`
     - Calcula `value_cop_modelo`:
       - Convierte USD modelo a COP usando tasa del período
   - Inserta en `calculator_history`:
     ```sql
     INSERT INTO calculator_history (
       model_id, platform_id, period_date, period_type,
       value, value_usd_bruto, value_usd_modelo, value_cop_modelo,
       created_at
     ) VALUES (...)
     ```
   - **VALIDACIÓN CRÍTICA:** Verifica que los registros se insertaron correctamente
     - Si falla la inserción, lanza error y NO continúa con el borrado

   **4.2. RESETEAR (Operación Atómica - Misma Transacción)**
   - Elimina todos los valores de `model_values` del período 1-15:
     ```sql
     DELETE FROM model_values 
     WHERE model_id = ? 
     AND period_date = '2025-12-01'
     ```
   - **Las calculadoras quedan en 0.00** para todas las plataformas
   - El modelo puede comenzar a ingresar valores para el nuevo período (16-31)

   **4.3. Resultado del Modelo**
   - Si exitoso: `closureSuccessCount++`
   - Si falla: `closureErrorCount++` y se registra el error

5. **00:01:30 - Validación de Integridad**
   - Verifica que todos los modelos tienen archivo completo:
     ```sql
     SELECT model_id, platform_id 
     FROM calculator_history 
     WHERE period_date = '2025-12-01' 
     AND period_type = '1-15'
     ```
   - Calcula estadísticas:
     - Total modelos con archivo
     - Total registros archivados
     - Promedio de plataformas por modelo
   - Identifica modelos marcados como exitosos pero sin plataformas archivadas

6. **00:01:45 - Validación Crítica de Errores**
   - Calcula umbral de errores: `10% del total de modelos`
   - Si `closureErrorCount > umbral`:
     - **DETIENE EL PROCESO COMPLETO**
     - Estado actualizado a: `failed`
     - Registra error en metadata
     - **NO RESETEA** `model_values` (previene pérdida de datos)
     - Retorna error 500 con detalles

---

##### **FASE 3: Espera para Resumen de Facturación (00:02:00 - 00:04:30)**

7. **00:02:00 - Inicio de Espera**
   - Estado actualizado a: `waiting_summary`
   - **Espera 2.5 minutos (150 segundos)**
   - **Razón:** Dar tiempo a que "Resumen de Facturación" reciba la última actualización de `calculator_history`

8. **00:04:30 - Finalización de Espera**
   - Estado actualizado a: `closing_summary`

---

##### **FASE 4: Actualización Automática del Resumen (00:04:30 - 00:05:00)**

9. **00:04:30 - El Resumen se Actualiza Automáticamente**
   - El endpoint `/api/admin/billing-summary` detecta automáticamente que el período está cerrado:
     - Verifica `calculator_period_closure_status` con `status = 'completed'` o `status = 'closing_summary'`
     - Cambia su fuente de datos:
       - **Antes:** Lee de `calculator_totals` (período activo)
       - **Después:** Lee de `calculator_history` (período cerrado)
   - Genera el resumen consolidado por sede/grupo
   - El resumen queda disponible en "Consulta Histórica" del Dashboard de Sedes

---

##### **FASE 5: Notificaciones (00:05:00 - 00:05:30)**

10. **00:05:00 - Notificaciones a Modelos**
    - Para cada modelo activo:
      - Envía notificación vía AIM Botty:
        > "El período ha cerrado. Tus valores han sido archivados y puedes revisarlos en 'Mi Historial'. La calculadora se ha reiniciado para el nuevo período. Puedes comenzar a ingresar valores nuevamente."

11. **00:05:15 - Notificaciones a Admins**
    - Obtiene todos los usuarios con `role = 'admin'` o `role = 'super_admin'` y `is_active = true`
    - Para cada admin:
      - Envía notificación vía AIM Botty:
        > "Período 1-15 (2025-12-01) cerrado exitosamente. El resumen está disponible en 'Consulta Histórica' del Dashboard de Sedes. Nuevo período 16-31 (2025-12-16) iniciado."

---

##### **FASE 6: Limpieza de Registros (00:05:30 - 00:05:45)**

12. **00:05:30 - Limpieza de Early Freeze**
    - Elimina registros de `calculator_early_frozen_platforms` del período cerrado:
      ```sql
      DELETE FROM calculator_early_frozen_platforms 
      WHERE period_date = '2025-12-01' 
      OR (period_date >= '2025-12-01' AND period_date <= '2025-12-15')
      ```
    - También elimina registros de períodos marcados como `completed`:
      ```sql
      DELETE FROM calculator_early_frozen_platforms efp
      WHERE EXISTS (
        SELECT 1 FROM calculator_period_closure_status cps
        WHERE cps.period_date = efp.period_date
        AND cps.status = 'completed'
      )
      ```
    - **Razón:** Liberar las plataformas especiales para el nuevo período

---

##### **FASE 7: Finalización (00:05:45 - 00:06:00)**

13. **00:05:45 - Completar Estado**
    - Estado actualizado a: `completed`
    - Registra `completed_at`: Timestamp actual
    - Registra metadata final:
      - Total de modelos procesados
      - Total de registros archivados
      - Promedio de plataformas por modelo
      - Tiempo total de ejecución

14. **00:06:00 - Proceso Completado**
    - Retorna respuesta JSON con:
      - `success: true`
      - Resumen de operaciones
      - Detalles por modelo

---

### 📍 ESCENARIO 2: CIERRE DEL PERÍODO 16-31 (Día 1 del mes siguiente)

El proceso es **idéntico** al escenario anterior, con las siguientes diferencias:

- **Early Freeze:** Se ejecuta el **día 31** (último día del mes)
- **Full Close:** Se ejecuta el **día 1** del mes siguiente
- **Período a cerrar:** 16-31 del mes anterior
- **Nuevo período:** 1-15 del mes actual

#### 🔍 **DETECCIÓN AUTOMÁTICA DEL ÚLTIMO DÍA DEL MES**

El sistema detecta automáticamente el último día del mes usando una técnica estándar de JavaScript:

```typescript
const lastDay = new Date(year, month, 0).getDate();
```

**¿Cómo funciona?**

Cuando pasas `0` como día en el constructor `new Date(year, month, 0)`, JavaScript automáticamente retrocede al último día del mes anterior. Esto funciona correctamente para todos los meses:

- **Febrero:** 
  - Años normales: 28 días
  - Años bisiestos: 29 días (detectado automáticamente)
- **Abril, Junio, Septiembre, Noviembre:** 30 días
- **Enero, Marzo, Mayo, Julio, Agosto, Octubre, Diciembre:** 31 días

**Ejemplos prácticos:**

```typescript
// Febrero 2025 (año normal)
new Date(2025, 2, 0).getDate()  // → 28

// Febrero 2024 (año bisiesto)
new Date(2024, 2, 0).getDate()  // → 29

// Abril 2025 (30 días)
new Date(2025, 4, 0).getDate()  // → 30

// Diciembre 2025 (31 días)
new Date(2025, 12, 0).getDate() // → 31
```

**Uso en el código:**

Cuando se cierra el período 16-31, el sistema calcula el rango de fechas así:

```typescript
if (periodToCloseType === '16-31') {
  periodStartDate = `${year}-${String(month).padStart(2, '0')}-16`;
  const lastDay = new Date(year, month, 0).getDate(); // ← Detecta automáticamente
  periodEndDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}
```

**Resultado:**
- **Febrero:** `2025-02-16` hasta `2025-02-28` (o `2025-02-29` en año bisiesto)
- **Abril:** `2025-04-16` hasta `2025-04-30`
- **Diciembre:** `2025-12-16` hasta `2025-12-31`

**✅ Ventajas:**
- No requiere tablas de referencia ni lógica condicional manual
- Maneja automáticamente años bisiestos
- Funciona correctamente para todos los meses sin excepciones

---

### 📍 ESCENARIO 3: DX LIVE - CONGELACIÓN ESPECIAL

**⏰ Hora:** 10:00 AM Colombia (días 1, 15, 16, 31)

**🎯 Objetivo:** Congelar DX Live a las 10:00 AM Colombia (no sigue la lógica de early freeze)

**📋 Proceso:**

1. **10:00:00 - Verificación del Cron Job**
   - El cron `/api/cron/period-closure-dxlive-freeze` se ejecuta a las 15:00 UTC (10:00 Colombia)
   - Verifica que es día 1, 15, 16 o 31
   - Llama al endpoint `/api/calculator/period-closure/platform-freeze-status`

2. **10:00:01 - Congelación de DX Live**
   - El endpoint `platform-freeze-status` detecta automáticamente:
     - Hora actual: 10:00 AM Colombia
     - Día relevante: 1, 15, 16 o 31
     - Plataforma: `dxlive`
   - Inserta registro en `calculator_early_frozen_platforms` para DX Live
   - DX Live queda bloqueado en "Mi Calculadora"

**Nota:** DX Live sigue la misma lógica de cierre de período que las demás plataformas, solo tiene un horario especial de congelación.

---

## 📊 ESTADOS DEL PROCESO

### Estados en `calculator_period_closure_status`:

1. **`pending`**: Período aún no iniciado
2. **`early_freezing`**: Early Freeze en proceso
3. **`closing_calculators`**: Archivo y reset en proceso
4. **`waiting_summary`**: Esperando actualización del resumen
5. **`closing_summary`**: Resumen de facturación actualizándose
6. **`completed`**: Período cerrado exitosamente
7. **`failed`**: Error durante el cierre (proceso detenido)

---

## 🔍 VALIDACIONES Y SEGURIDAD

### Validaciones Críticas:

1. **Validación de Archivo:**
   - Verifica que cada registro insertado en `calculator_history` tiene:
     - `value_usd_bruto` definido
     - `value_usd_modelo` definido
     - `value_cop_modelo` definido
   - Si falla, lanza error y NO borra `model_values`

2. **Umbral de Errores:**
   - Si más del 10% de los modelos fallan al archivar:
     - Detiene el proceso completo
     - Marca estado como `failed`
     - NO resetea `model_values` (previene pérdida de datos)

3. **Verificación de Duplicados:**
   - Early Freeze verifica que no se haya ejecutado ya hoy
   - Full Close verifica que el período no esté ya cerrado

4. **Limpieza Agresiva:**
   - Elimina registros de `calculator_early_frozen_platforms` para períodos cerrados
   - Evita que plataformas queden bloqueadas después del cierre

### ✅ SISTEMA DE BACKUP: ESTADO ACTUAL

**✅ IMPLEMENTADO Y ACTIVO**

El sistema **crea un backup explícito** antes del archivado en la **FASE 1.5**. El proceso incluye:

1. **Backup Explícito:**
   - Se ejecuta automáticamente antes del archivado (FASE 1.5)
   - Guarda todos los valores de `model_values` del período a cerrar
   - Guarda las tasas activas en ese momento
   - Guarda la configuración del modelo
   - Se almacena en `calc_snapshots` con UUID determinístico

2. **Operación Atómica:**
   - El archivado y borrado ocurren en la misma función `atomicArchiveAndReset()`
   - Si el archivado falla, el borrado NO se ejecuta
   - Los datos permanecen en `model_values`

3. **Validaciones Post-Archivo:**
   - Después de insertar en `calculator_history`, se verifica que los registros existan
   - Se valida que todos los campos calculados estén completos
   - Solo si la validación pasa, se procede al borrado

4. **Umbral de Errores:**
   - Si más del 10% de modelos fallan, el proceso se detiene completamente
   - Los datos NO se borran si hay errores significativos

**📋 Estructura del Backup:**

El backup se guarda en `calc_snapshots` con la siguiente estructura:

```typescript
{
  model_id: string,           // ID del modelo
  period_id: string,          // UUID determinístico generado desde period_date + period_type + model_id
  totals_json: {
    period_date: string,      // Fecha del período (ej: "2025-12-01")
    period_type: string,      // Tipo de período ("1-15" o "16-31")
    period_start: string,     // Fecha de inicio del período
    period_end: string,       // Fecha de fin del período
    values: Array,            // Todos los valores por plataforma
    total_platforms: number,   // Cantidad de plataformas con valores
    total_value: number,      // Suma total de valores
    snapshot_metadata: {
      created_at: string,     // Timestamp del backup
      backup_purpose: string  // "period_closure_safety_backup"
    }
  },
  rates_applied_json: {
    rates: Array,             // Tasas activas en ese momento
    model_config: Object,     // Configuración del modelo
    snapshot_timestamp: string, // Timestamp del backup
    period_reference: string  // Referencia única del período
  }
}
```

**✅ Ventajas del Backup Implementado:**

- **Recuperación Completa:** Si el archivado falla parcialmente, los datos pueden restaurarse desde `calc_snapshots`
- **Punto de Restauración Conocido:** Estado exacto de los datos antes del cierre
- **Auditoría:** Historial completo de cómo estaban los datos antes de cada cierre
- **Seguridad Adicional:** Capa extra de protección más allá de las validaciones
- **No Bloqueante:** Si el backup falla, el proceso continúa (no es crítico para el cierre)

**🔍 Comportamiento del Backup:**

- Se ejecuta para **todos los modelos activos** antes del archivado
- Si un backup falla para un modelo específico, se registra el error pero el proceso continúa
- Los backups se almacenan con UUID determinístico, permitiendo identificar fácilmente el backup de un período específico
- El backup incluye **toda la información necesaria** para restaurar el estado completo del período

---

## 📈 FLUJO DE DATOS

### Antes del Cierre (Período Activo):
```
model_values (valores activos)
    ↓
calculator_totals (totales consolidados)
    ↓
Resumen de Facturación (lee de calculator_totals)
```

### Durante el Cierre:
```
model_values (valores activos)
    ↓
[ARCHIVAR] → calculator_history (valores archivados)
    ↓
[RESETEAR] → model_values (vacío, valores en 0)
```

### Después del Cierre (Período Cerrado):
```
calculator_history (valores archivados)
    ↓
Resumen de Facturación (lee de calculator_history)
    ↓
Mi Historial (muestra períodos cerrados)
```

---

## ⚠️ CASOS ESPECIALES

### 1. Reconstrucción de Datos Perdidos

Si `calculator_history` está vacío para un período cerrado:

- **"Mi Historial":** Reconstruye desde `calculator_totals` creando períodos "sintéticos"
- **"Resumen de Facturación":** Reconstruye desde `calculator_totals` consolidando por sede/grupo

**Nota:** Esta es una medida de emergencia. El sistema debe garantizar que los datos se archiven correctamente.

### 2. Corrección de Año (2024 → 2025)

Si los datos fueron guardados con año incorrecto:

- El sistema detecta y corrige automáticamente el año al reconstruir
- Los períodos sintéticos incluyen una nota indicando la reconstrucción

### 3. Ejecución Manual (Bypass)

Los endpoints aceptan headers especiales para ejecución manual:

- `x-testing-mode: true`: Modo testing (reduce tiempos de espera)
- `x-force-period-date`: Fuerza un período específico
- `x-force-period-type`: Fuerza un tipo de período específico
- `x-force-close-secret`: Secret key para autorización

---

## 🎯 RESUMEN EJECUTIVO

### Timeline Visual:

```
DÍA 15 (18:00 Colombia)
├─ Early Freeze ejecuta
├─ 10 plataformas especiales se congelan
└─ Estado: closing_calculators

DÍA 16 (00:00 Colombia)
├─ Full Close ejecuta
├─ FASE 1: Verificación (00:00:00 - 00:00:01)
├─ FASE 2: Archivar y Resetear (00:00:02 - 00:02:00)
│  ├─ Archivar en calculator_history
│  └─ Resetear model_values a 0
├─ FASE 3: Espera (00:02:00 - 00:04:30)
├─ FASE 4: Resumen se actualiza (00:04:30 - 00:05:00)
├─ FASE 5: Notificaciones (00:05:00 - 00:05:30)
├─ FASE 6: Limpieza (00:05:30 - 00:05:45)
└─ FASE 7: Completar (00:05:45 - 00:06:00)
   └─ Estado: completed
```

### Duración Total del Cierre Completo:
- **Aproximadamente 6 minutos** desde el inicio hasta la finalización

### Tablas Afectadas:
1. `calculator_period_closure_status` (estados)
2. `calculator_early_frozen_platforms` (congelaciones)
3. `calculator_history` (archivo)
4. `model_values` (reset)
5. `calculator_totals` (no se modifica, pero se deja de usar para períodos cerrados)

---

## 🔗 ENDPOINTS RELACIONADOS

- `/api/cron/period-closure-early-freeze` - Cron para Early Freeze
- `/api/cron/period-closure-full-close` - Cron para Full Close
- `/api/cron/period-closure-dxlive-freeze` - Cron para DX Live
- `/api/calculator/period-closure/early-freeze` - Endpoint de Early Freeze
- `/api/calculator/period-closure/close-period` - Endpoint de Full Close
- `/api/calculator/period-closure/platform-freeze-status` - Estado de congelación
- `/api/admin/billing-summary` - Resumen de facturación
- `/api/model/calculator/historial` - Historial de períodos cerrados

---

**Última actualización:** Diciembre 2025  
**Versión del documento:** 1.0

