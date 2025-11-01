# 📊 Cómo Funciona el Cierre de Facturación - Resumen de Facturación

**Fecha:** 31 de Octubre 2025  
**Estado:** ✅ **Sistema Implementado**

---

## 🎯 RESUMEN EJECUTIVO

El **"Resumen de Facturación" NO hace el cierre directamente**. Es una **interfaz de lectura** que automáticamente detecta si el período está activo o cerrado y consulta la tabla correcta.

El **cierre real** lo hace el **sistema de cierre de períodos** (endpoint `/api/calculator/period-closure/close-period`).

---

## 🔄 FLUJO COMPLETO DEL CIERRE

### FASE 1: Durante el Período Activo

```
┌─────────────────────────────────────────┐
│   "Mi Calculadora" (Modelos)           │
│   ↓                                     │
│   Guardan valores en model_values       │
│   ↓                                     │
│   Se calculan totales → calculator_totals │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   "Resumen de Facturación"              │
│   - Lee de calculator_totals            │
│   - Muestra datos en tiempo real       │
│   - Actualización continua             │
└─────────────────────────────────────────┘
```

**Estado:** Período ACTIVO  
**Fuente de datos:** `calculator_totals`  
**Actualización:** Continua (cada vez que un modelo guarda valores)

---

### FASE 2: Momento del Cierre (00:00 Colombia, días 1 y 16)

El **cron job** ejecuta `/api/cron/period-closure-full-close` que llama a:

```
┌─────────────────────────────────────────┐
│   Sistema de Cierre de Períodos        │
│   /api/calculator/period-closure/close-period │
└─────────────────────────────────────────┘
```

#### Sub-Fases del Cierre:

**2.1. ARCHIVAR** (FASE 1 del sistema de cierre)
```
- Lee valores de model_values para el período
- Inserta en calculator_history con period_type ('1-15' o '16-31')
- Marca estado: 'closing_calculators'
```

**2.2. ESPERAR** (FASE 2 del sistema de cierre)
```
- Espera 2.5 minutos (150 segundos)
- Razón: Dar tiempo a que Resumen de Facturación reciba última actualización
- Marca estado: 'waiting_summary'
```

**2.3. RESUMEN SE ACTUALIZA AUTOMÁTICAMENTE** (FASE 3 del sistema de cierre)
```
- El Resumen de Facturación NO necesita hacer nada especial
- Automáticamente detecta que el período está cerrado
- Cambia su fuente de datos de calculator_totals → calculator_history
- Marca estado: 'closing_summary'
```

**2.4. RESETEAR CALCULADORAS** (FASE 4 del sistema de cierre)
```
- Elimina valores de model_values para el período cerrado
- Las calculadoras quedan en 0.00
- Marca estado: 'archiving' → 'completed'
```

---

### FASE 3: Después del Cierre

```
┌─────────────────────────────────────────┐
│   "Resumen de Facturación"              │
│   - Detecta que período está CERRADO   │
│   - Lee de calculator_history          │
│   - Muestra datos archivados            │
│   - Disponible en "Consulta Histórica" │
└─────────────────────────────────────────┘
```

**Estado:** Período CERRADO  
**Fuente de datos:** `calculator_history`  
**Actualización:** Estática (datos congelados del período cerrado)

---

## 🔍 CÓMO DETECTA EL RESUMEN QUE EL PERÍODO ESTÁ CERRADO

### Lógica en `app/api/admin/billing-summary/route.ts`:

```typescript
// 1. Obtiene fecha actual en Colombia
const todayStr = getColombiaDate();

// 2. Calcula rango de quincena según periodDate solicitado
const quinStartStr = day <= 15 ? 'YYYY-MM-01' : 'YYYY-MM-16';
const quinEndStr = day <= 15 ? 'YYYY-MM-15' : 'YYYY-MM-lastDay';

// 3. Determina si el período está activo
const isActivePeriod = todayStr >= quinStartStr && todayStr <= quinEndStr;

// 4. Consulta la tabla correcta según el estado
if (isActivePeriod) {
  // Período ACTIVO → leer de calculator_totals
  const totals = await supabase
    .from('calculator_totals')
    .select('*')
    .gte('period_date', startStr)
    .lte('period_date', endStr);
} else {
  // Período CERRADO → leer de calculator_history
  const history = await supabase
    .from('calculator_history')
    .select('*')
    .gte('period_date', startStr)
    .lte('period_date', endStr)
    .eq('period_type', expectedType);
}
```

---

## 📋 RESPONSABILIDADES DE CADA COMPONENTE

### "Resumen de Facturación" (`billing-summary`)

**Responsabilidades:**
- ✅ **Leer** datos de `calculator_totals` (período activo)
- ✅ **Leer** datos de `calculator_history` (período cerrado)
- ✅ **Detectar automáticamente** si período está activo o cerrado
- ✅ **Mostrar** datos consolidados por modelo/sede
- ✅ **Actualizar** en tiempo real durante período activo

**NO hace:**
- ❌ No archiva datos
- ❌ No resetea calculadoras
- ❌ No crea archivos históricos
- ❌ No ejecuta cierres

---

### Sistema de Cierre de Períodos (`period-closure/close-period`)

**Responsabilidades:**
- ✅ **Archivar** valores de `model_values` → `calculator_history`
- ✅ **Resetear** calculadoras (eliminar `model_values`)
- ✅ **Esperar** tiempo suficiente para que Resumen se actualice
- ✅ **Notificar** a modelos y admins vía AIM Botty
- ✅ **Marcar** estado del cierre en `calculator_period_closure_status`

**NO hace:**
- ❌ No lee ni muestra datos
- ❌ No actualiza el Resumen directamente
- ❌ No crea archivos físicos (todo está en BD)

---

## 🔄 INTEGRACIÓN ENTRE SISTEMAS

### Comunicación:

```
Sistema de Cierre              Resumen de Facturación
──────────────────────         ─────────────────────────

1. Archiva datos
   model_values → 
   calculator_history
                          →
                          
2. Espera 2.5 minutos
   (dar tiempo al Resumen)
                          →
                          
3. Resumen detecta
   automáticamente que
   período está cerrado
                          ←
                          
4. Resumen lee de
   calculator_history
                          ←
```

**No hay comunicación directa.** El Resumen simplemente **detecta el cambio de estado** basándose en la fecha.

---

## 📊 TABLAS DE BASE DE DATOS

### Durante Período Activo:
- ✅ `model_values` - Valores individuales por plataforma
- ✅ `calculator_totals` - Totales consolidados por modelo
- ✅ `calculator_history` - Vacío (aún no se ha cerrado)

### Durante Período Cerrado:
- ✅ `model_values` - Vacío (reseteado por sistema de cierre)
- ✅ `calculator_totals` - Vacío o desactualizado (no se usa)
- ✅ `calculator_history` - Datos archivados del período cerrado

---

## ⏰ TIMELINE DEL CIERRE

### Día 1 o 16, 00:00 Colombia:

```
00:00:00 - Cron job ejecuta close-period
00:00:01 - Archiva valores a calculator_history
00:00:02 - Espera 2.5 minutos...
00:02:30 - Resetea calculadoras (elimina model_values)
00:02:31 - Notifica a modelos y admins
00:02:32 - Marca estado como 'completed'

Después:
- Resumen de Facturación automáticamente detecta que período está cerrado
- Cambia a leer de calculator_history
- Muestra datos archivados
```

---

## 🎯 PUNTOS CLAVE

1. **El Resumen NO cierra** - Solo lee datos
2. **El cierre es automático** - Ejecutado por cron jobs
3. **El Resumen detecta el cierre** - Basándose en fecha Colombia
4. **No hay archivo físico** - Todo está en BD (`calculator_history`)
5. **Consulta Histórica** - Es el mismo Resumen de Facturación mostrando períodos cerrados

---

## 📝 RESUMEN PARA EL USUARIO

**¿Cómo cierra el Resumen de Facturación?**

**Respuesta:** El Resumen de Facturación **NO cierra directamente**. 

- El **sistema de cierre de períodos** (automatizado por cron) es quien:
  1. Archiva los valores a `calculator_history`
  2. Resetea las calculadoras
  3. Notifica a usuarios

- El **Resumen de Facturación** simplemente:
  1. **Detecta automáticamente** que el período cambió de activo a cerrado
  2. **Cambia su fuente de datos** de `calculator_totals` → `calculator_history`
  3. **Muestra los datos archivados** como "Consulta Histórica"

**En resumen:** El Resumen es inteligente y automático. Cuando el período cierra, automáticamente lee de la tabla histórica sin necesidad de intervención manual.

---

**Última actualización:** 31 de Octubre 2025, 22:00 Colombia

