# 🔄 COMPATIBILIDAD: Rates Históricas vs Rates Actuales

## 📊 RESUMEN EJECUTIVO

Las **rates históricas** implementadas para el Gestor están **completamente separadas** de las **rates actuales** del sistema. No hay conflictos ni interferencias entre ambas.

---

## 🏗️ ESTRUCTURA COMPARATIVA

### **1. Rates Actuales (`rates` table)**

**Propósito:** Gestionar tasas de cambio vigentes para períodos actuales y futuros.

**Estructura:**
```sql
rates (
  id uuid,
  kind text,              -- 'USD→COP', 'EUR→USD', 'GBP→USD' (con flecha)
  value numeric(18,4),     -- Valor de la tasa
  scope text,             -- 'global', 'group', 'model'
  scope_id uuid,          -- ID del grupo o modelo (si aplica)
  author_id uuid,         -- Usuario que configuró
  valid_from timestamptz, -- Inicio de vigencia
  valid_to timestamptz,   -- Fin de vigencia (NULL = activa)
  active boolean          -- Estado activo/inactivo
)
```

**Características:**
- ✅ Gestionadas por `admin` y `super_admin` únicamente
- ✅ Tienen vigencia temporal (`valid_from`, `valid_to`)
- ✅ Pueden ser globales, por grupo o por modelo
- ✅ Se usan para cálculos en períodos actuales
- ✅ Se consultan desde `/api/rates-v2`

**Nomenclatura:**
- Campo `kind`: `'USD→COP'`, `'EUR→USD'`, `'GBP→USD'` (con flecha →)

---

### **2. Rates Históricas (`gestor_historical_rates` table)**

**Propósito:** Permitir a gestores recalcular períodos históricos específicos con rates diferentes.

**Estructura:**
```sql
gestor_historical_rates (
  id uuid,
  group_id uuid,          -- Grupo/sede específico
  period_date date,        -- Fecha de inicio del período (1 o 16)
  period_type text,        -- '1-15' o '16-31'
  rate_usd_cop numeric,    -- Tasa USD→COP (snake_case)
  rate_eur_usd numeric,    -- Tasa EUR→USD (snake_case)
  rate_gbp_usd numeric,    -- Tasa GBP→USD (snake_case)
  configurado_por uuid,   -- Gestor/Admin que configuró
  aplicado_at timestamptz, -- Fecha de aplicación (NULL = no aplicadas)
  aplicado_por uuid       -- Usuario que aplicó
)
```

**Características:**
- ✅ Gestionadas por `gestor`, `admin` y `super_admin`
- ✅ Vinculadas a un grupo y período específico
- ✅ **SOLO afectan a períodos históricos** (no actuales)
- ✅ Se usan para recalcular `calculator_history`
- ✅ Se consultan desde `/api/gestor/historical-rates`

**Nomenclatura:**
- Columnas: `rate_usd_cop`, `rate_eur_usd`, `rate_gbp_usd` (snake_case)

---

## 🔄 CONVERSIÓN Y COMPATIBILIDAD

### **En los Cálculos:**

Las rates históricas se convierten al formato estándar usado por el sistema de cálculos:

```typescript
// Formato en gestor_historical_rates (snake_case)
{
  rate_usd_cop: 3900,
  rate_eur_usd: 1.01,
  rate_gbp_usd: 1.20
}

// Se convierte a formato de cálculos (guión bajo, mayúsculas)
{
  USD_COP: 3900,
  EUR_USD: 1.01,
  GBP_USD: 1.20
}
```

Este formato (`USD_COP`, `EUR_USD`, `GBP_USD`) es el mismo que usa:
- `lib/calculadora/calc.ts` → `RatesEffective`
- `lib/gestor/stats-calculations.ts` → Conversión interna
- `app/api/gestor/historical-rates/apply/route.ts` → Al recalcular `calculator_history`

---

## ✅ GARANTÍAS DE NO CONFLICTO

### **1. Tablas Separadas**
- `rates` → Rates actuales
- `gestor_historical_rates` → Rates históricas
- **No comparten campos ni constraints**

### **2. Propósitos Diferentes**
- **Rates actuales:** Para períodos en curso y futuros
- **Rates históricas:** Para recalcular períodos pasados

### **3. Alcance Diferente**
- **Rates actuales:** Pueden ser globales, por grupo o por modelo
- **Rates históricas:** Siempre por grupo y período específico

### **4. Permisos Diferentes**
- **Rates actuales:** Solo `admin` y `super_admin`
- **Rates históricas:** `gestor`, `admin` y `super_admin`

### **5. Aplicación Diferente**
- **Rates actuales:** Se usan automáticamente en cálculos actuales
- **Rates históricas:** Se aplican manualmente para recalcular `calculator_history`

---

## 🎯 FLUJO DE USO

### **Rates Actuales:**
```
Admin configura rates → rates table → 
Se usan automáticamente en Mi Calculadora → 
Cálculos en períodos actuales
```

### **Rates Históricas:**
```
Gestor configura rates → gestor_historical_rates table → 
Gestor hace clic en "Aplicar" → 
Se recalculan valores en calculator_history → 
Se actualizan vistas históricas (Mi Historia, Resumen de Productividad)
```

---

## 📝 CONCLUSIÓN

✅ **Las rates históricas NO entran en conflicto con las rates actuales.**

✅ **Son sistemas complementarios e independientes:**

- **Rates actuales:** Para gestionar tasas vigentes
- **Rates históricas:** Para corregir/recalcular períodos pasados

✅ **La nomenclatura es compatible:**
- Se convierten automáticamente al formato estándar (`USD_COP`, `EUR_USD`, `GBP_USD`)
- Los cálculos funcionan con ambos sistemas sin problemas

✅ **No hay interferencia:**
- Tablas diferentes
- Propósitos diferentes
- Alcances diferentes
- Permisos diferentes

---

## 🔍 VERIFICACIÓN

Para verificar que no hay conflictos:

1. **Rates actuales** se consultan desde `/api/rates-v2`
2. **Rates históricas** se consultan desde `/api/gestor/historical-rates`
3. **No hay solapamiento** en las consultas
4. **No hay dependencias cruzadas** entre tablas

---

**Última actualización:** 2025-01-XX**

