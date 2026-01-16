# 🔄 PROPUESTA: NUEVO SISTEMA DE CIERRE DE PERÍODO

## 📋 PROBLEMAS DEL SISTEMA ACTUAL

### ❌ **Cierre Automático Frágil:**
- El cron puede fallar (ya falló el 16-ene)
- Si falla, pierdes TODO
- No hay supervisión humana
- No hay forma de "rehacer" si algo sale mal

### ❌ **Eliminación Irreversible:**
- `model_values` se borra → datos perdidos
- No se puede regenerar el archivo
- No hay "deshacer"
- Dependemos de backups que pueden fallar

### ❌ **Sin Control Manual:**
- No puedes archivar modelo por modelo
- Todo se hace en batch o nada
- No puedes corregir errores individuales
- Los admins no tienen herramientas

---

## ✅ NUEVO SISTEMA PROPUESTO

### 🎯 **FILOSOFÍA:**
> "Los datos NUNCA se eliminan, solo se archivan y marcan como procesados"

### 📊 **FLUJO NUEVO:**

```
ANTES (AUTOMÁTICO):
==================
Día 16 00:00 → Cron se ejecuta → Archiva TODO → Borra TODO → 💀 Si falla, se perdió

DESPUÉS (MANUAL CON CONTROL):
==============================
Día 16 → Admin revisa → Selecciona modelos → Presiona "Archivar" → 
  ↓
Copia a calculator_history → Marca como archivado → Datos persisten
  ↓
Si algo falla → Volver a intentar (datos siguen ahí)
  ↓
Admin confirma → Listo
```

---

## 🏗️ ARQUITECTURA NUEVA

### 1️⃣ **CAMBIOS EN BASE DE DATOS**

#### A. Agregar campo `archived` a `model_values`
```sql
ALTER TABLE model_values 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id);

CREATE INDEX idx_model_values_archived ON model_values(archived);
CREATE INDEX idx_model_values_period_archived ON model_values(period_date, archived);
```

**Propósito:**
- `archived = false`: Valores activos (se muestran en "Mi Calculadora")
- `archived = true`: Valores archivados (NO se muestran, pero existen)
- `archived_at`: Fecha del archivo (auditoría)
- `archived_by`: Quién lo archivó (auditoría)

#### B. Nueva tabla `manual_archive_log`
```sql
CREATE TABLE manual_archive_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES users(id),
    period_date DATE,
    period_type TEXT,
    archived_by UUID REFERENCES users(id),
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    records_archived INTEGER,
    status TEXT, -- 'success', 'failed', 'regenerated'
    notes TEXT,
    metadata JSONB
);
```

**Propósito:** Auditoría de cada archivo manual.

---

### 2️⃣ **INTERFAZ PARA ADMINS**

#### **Ubicación:** Nueva página `/admin/period-closure`

#### **Vista Principal:**
```
╔════════════════════════════════════════════════════════════════╗
║  📊 CIERRE DE PERÍODO: ENERO 2026 - P1 (1-15)                 ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  Estado General:                                                ║
║  • Modelos totales: 30                                         ║
║  • Archivados: 5 ✅                                            ║
║  • Pendientes: 25 ⏳                                           ║
║  • Con errores: 0 ❌                                           ║
║                                                                 ║
║  [🔒 Archivar Todos] [📊 Ver Reporte] [🔄 Regenerar Errores] ║
║                                                                 ║
╠════════════════════════════════════════════════════════════════╣
║ Modelo               | Plataformas | Total USD | Estado       ║
╠════════════════════════════════════════════════════════════════╣
║ maria@example.com    |     8       | $450.00   | [📦 Archivar]║
║ sofia@example.com    |    12       | $680.00   | [📦 Archivar]║
║ laura@example.com    |     5       | $320.00   | ✅ Archivado ║
║ carmen@example.com   |     9       | $510.00   | [📦 Archivar]║
║ ana@example.com      |     0       |   $0.00   | Sin datos    ║
╚════════════════════════════════════════════════════════════════╝
```

#### **Funcionalidades:**

1. **Botón Individual "Archivar"**: Archiva solo esa modelo
2. **Botón "Archivar Todos"**: Procesa todos los pendientes
3. **Ver Reporte**: Muestra detalle de lo que se archivó
4. **Regenerar**: Si algo falló, volver a intentar (datos siguen ahí)
5. **Filtros**: Por grupo, por estado, por rango de fechas

---

### 3️⃣ **ENDPOINTS API**

#### **A. Archivar modelo individual**
```typescript
POST /api/admin/period-closure/archive-model
Body: {
  modelId: string,
  periodDate: string,
  periodType: '1-15' | '16-31'
}
```

**Proceso:**
1. Obtener todos los `model_values` del modelo en ese período
2. Crear registros en `calculator_history`
3. Marcar como `archived = true` en `model_values` (NO eliminar)
4. Registrar en `manual_archive_log`
5. Retornar resultado

#### **B. Archivar múltiples modelos**
```typescript
POST /api/admin/period-closure/archive-batch
Body: {
  modelIds: string[],
  periodDate: string,
  periodType: '1-15' | '16-31'
}
```

#### **C. Obtener estado del cierre**
```typescript
GET /api/admin/period-closure/status?periodDate=2026-01-01&periodType=1-15
Response: {
  total: 30,
  archived: 5,
  pending: 25,
  errors: 0,
  models: [{...}]
}
```

#### **D. Regenerar archivo**
```typescript
POST /api/admin/period-closure/regenerate
Body: {
  modelId: string,
  periodDate: string
}
```

**Proceso:**
1. Eliminar registros anteriores de `calculator_history`
2. Volver a crear desde `model_values` (que siguen ahí)
3. Actualizar log

---

### 4️⃣ **LÓGICA DE "MI CALCULADORA"**

#### **Consulta actual:**
```typescript
// ANTES
const { data } = await supabase
  .from('model_values')
  .select('*')
  .eq('model_id', modelId)
  .eq('period_date', periodDate);
```

#### **Consulta nueva:**
```typescript
// DESPUÉS - Solo mostrar NO archivados
const { data } = await supabase
  .from('model_values')
  .select('*')
  .eq('model_id', modelId)
  .eq('period_date', periodDate)
  .eq('archived', false);  // ← NUEVO FILTRO
```

**Efecto:**
- Período activo (P2 enero): Muestra valores normalmente
- Período archivado (P1 enero): NO muestra nada (está limpio)
- Datos siguen en BD, solo ocultos

---

### 5️⃣ **LÓGICA DE "MI HISTORIAL"**

#### **Ocultar períodos con consolidados:**
```typescript
// Filtrar períodos que tengan platform_id consolidado
const periodsToShow = allPeriods.filter(period => {
  const hasConsolidatedOnly = period.platforms.every(p => 
    p.platform_id.includes('CONSOLIDATED') || 
    p.platform_id.includes('consolidated')
  );
  return !hasConsolidatedOnly;  // Solo mostrar si tiene detalle real
});
```

**Efecto:**
- P1 enero 2026: NO aparece (es consolidado)
- Otros períodos: Aparecen normalmente

---

## 🔧 IMPLEMENTACIÓN POR FASES

### **FASE 1: BASE DE DATOS** (30 minutos)
```sql
-- 1. Agregar campos a model_values
ALTER TABLE model_values 
ADD COLUMN archived BOOLEAN DEFAULT FALSE,
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN archived_by UUID REFERENCES users(id);

-- 2. Crear índices
CREATE INDEX idx_model_values_archived ON model_values(archived);

-- 3. Crear tabla de log
CREATE TABLE manual_archive_log (...);

-- 4. Marcar P1 como archivado (para que no se muestre)
UPDATE model_values 
SET archived = true, 
    archived_at = '2026-01-16 00:00:00',
    archived_by = NULL  -- Sistema
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-15';
```

### **FASE 2: API** (2 horas)
- Crear endpoints en `app/api/admin/period-closure/`
- Implementar lógica de archivo sin borrado
- Agregar validaciones y auditoría

### **FASE 3: INTERFAZ ADMIN** (3 horas)
- Crear página `/admin/period-closure`
- Lista de modelos con botones
- Modal de confirmación
- Indicadores de progreso

### **FASE 4: AJUSTES EN CALCULADORA** (1 hora)
- Agregar filtro `archived = false` a todas las consultas
- Probar que períodos archivados no se ven
- Verificar que período actual funciona normal

### **FASE 5: AJUSTES EN HISTORIAL** (1 hora)
- Filtrar consolidados de "Mi Historial"
- Agregar nota si un período no está disponible
- Probar con modelo de prueba

### **FASE 6: CRON COMO FALLBACK** (30 minutos)
- Mantener el cron pero como "notificación"
- En lugar de ejecutar, envía alerta: "Es día de cierre, favor archivar manualmente"
- Los admins tienen 48 horas para archivar

---

## 🎯 VENTAJAS DEL NUEVO SISTEMA

### ✅ **Control Total:**
- Admin decide cuándo archivar cada modelo
- Puede revisar datos antes de archivar
- Puede archivar en lotes o individual

### ✅ **Sin Pérdida de Datos:**
- `model_values` NUNCA se elimina
- Solo se marca como archivado
- Se puede regenerar el historial si es necesario

### ✅ **Auditoría Completa:**
- Quién archivó qué y cuándo
- Log de cada operación
- Rastreable para compliance

### ✅ **Recuperación de Errores:**
- Si el archivo falla, reintentar
- Si el historial está mal, regenerar
- No hay "punto de no retorno"

### ✅ **Transparencia con Modelos:**
- Si no hay detalle, no se muestra (honesto)
- No inventamos datos falsos
- Los admins pueden explicar situaciones especiales

---

## 📝 PARA EL P1 ENERO 2026

### **Solución Inmediata:**

1. **Ejecutar `ROLLBACK;`** (no confirmar el delete)

2. **Ocultar P1 de "Mi Historial":**
```typescript
// En app/admin/model/calculator/historial/page.tsx
const filteredPeriods = periods.filter(period => {
  // Ocultar enero P1 2026 (solo consolidado)
  if (period.period_date === '2026-01-01' && period.period_type === '1-15') {
    return false;
  }
  return true;
});
```

3. **Mantener en dashboards admin:**
- Los totales siguen en `calculator_totals`
- Los admins los ven en "Resumen de Facturación"
- Para efectos de pago y contabilidad

4. **Explicación a modelos** (si preguntan):
> "Hubo un problema técnico con el detalle del P1 de enero. 
> Los totales están correctos y se considerarán para tu pago. 
> Disculpa las molestias."

---

## ❓ **¿PROCEDEMOS?**

Propongo:

1. ✅ **AHORA** (5 min): Hacer `ROLLBACK;` y ocultar P1 de "Mi Historial"
2. ✅ **HOY** (30 min): Implementar cambios en BD (FASE 1)
3. ✅ **MAÑANA** (6 horas): Implementar API + UI (FASES 2-3)
4. ✅ **PASADO** (2 horas): Ajustes finales (FASES 4-5)

**Total:** ~2 días de trabajo para tener el nuevo sistema completo.

**¿Estás de acuerdo con este plan?**
