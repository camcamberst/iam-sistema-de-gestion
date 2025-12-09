# 📊 ANÁLISIS COMPLETO: INTEGRACIÓN DE NUEVAS PLATAFORMAS EN AIM SISTEMA DE GESTIÓN

## 🎯 OBJETIVO
Analizar todas las implicaciones, dependencias, validaciones y funciones que interactúan con las plataformas para poder implementar de forma segura una funcionalidad que permita crear y añadir nuevas plataformas desde la interfaz del sistema.

---

## 📋 ESTRUCTURA DE BASE DE DATOS

### 1. **Tabla Principal: `calculator_platforms`**
**Ubicación:** `db/calculadora/calculator_config.sql` (líneas 87-124)

**Estructura:**
```sql
CREATE TABLE calculator_platforms (
  id text PRIMARY KEY,                    -- ID único (ej: 'chaturbate', 'myfreecams')
  name text NOT NULL,                     -- Nombre legible (ej: 'Chaturbate')
  description text NULL,                  -- Descripción opcional
  currency text NOT NULL DEFAULT 'USD',    -- Moneda base: 'USD', 'EUR', 'GBP'
  token_rate numeric(18,4) NULL,           -- Tasa de conversión tokens→USD (ej: 0.05)
  discount_factor numeric(5,4) NULL,       -- Factor de descuento (ej: 0.75 = 25% descuento)
  tax_rate numeric(5,4) NULL,              -- Tasa de impuesto (ej: 0.16 = 16% impuesto)
  direct_payout boolean DEFAULT FALSE,     -- Si paga 100% directo (ej: SUPERFOON)
  payment_frequency text,                  -- 'quincenal' o 'mensual'
  active boolean DEFAULT TRUE,             -- Si está activa en el sistema
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Características críticas:**
- ✅ **ID es PRIMARY KEY de tipo TEXT** - No es UUID, es un identificador legible
- ✅ **UNIQUE constraint en `id`** - No puede haber duplicados
- ✅ **RLS habilitado** - Solo lectura pública de plataformas activas
- ⚠️ **NO hay validación de integridad referencial** - Las plataformas pueden eliminarse sin restricciones explícitas

---

### 2. **Tabla de Relación: `modelo_plataformas`**
**Ubicación:** `db/modelo_plataformas_schema_optimized.sql`

**Estructura:**
```sql
CREATE TABLE modelo_plataformas (
  id UUID PRIMARY KEY,
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'desactivada', 'inviable')),
  -- ... campos de auditoría y timestamps
  UNIQUE(model_id, platform_id)
);
```

**Dependencias críticas:**
- ⚠️ **`ON DELETE CASCADE`** - Si se elimina una plataforma de `calculator_platforms`, se eliminan TODAS las relaciones en `modelo_plataformas`
- ⚠️ **Foreign Key constraint** - No se puede crear una relación con una plataforma que no existe

---

### 3. **Tabla de Configuración: `calculator_config`**
**Ubicación:** `db/calculadora/calculator_config.sql` (líneas 6-80)

**Estructura:**
```sql
CREATE TABLE calculator_config (
  id uuid PRIMARY KEY,
  model_id uuid REFERENCES users(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES users(id) ON DELETE CASCADE,
  enabled_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Array de IDs de plataformas
  -- ... configuración de porcentajes y cuotas
);
```

**Dependencias críticas:**
- ⚠️ **`enabled_platforms` es JSONB** - Almacena array de IDs de plataformas como strings
- ⚠️ **NO hay validación de integridad** - Puede contener IDs de plataformas que ya no existen
- ⚠️ **Si se elimina una plataforma, los IDs quedan huérfanos en el JSONB**

---

### 4. **Tabla de Valores: `model_values`**
**Ubicación:** `db/calculadora/model_values.sql`

**Estructura:**
```sql
CREATE TABLE model_values (
  id uuid PRIMARY KEY,
  model_id uuid REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL,  -- ⚠️ NO es Foreign Key, solo texto
  value numeric(18,6) NOT NULL,
  period_date date,
  -- ...
);
```

**Dependencias críticas:**
- ⚠️ **`platform` es TEXT, NO Foreign Key** - No hay validación de integridad
- ⚠️ **Puede contener IDs de plataformas eliminadas** - Datos históricos pueden quedar huérfanos

---

### 5. **Tabla de Historial: `calculator_history`**
**Ubicación:** `create_calculator_history_table.sql`

**Estructura:**
```sql
CREATE TABLE calculator_history (
  id UUID PRIMARY KEY,
  model_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,  -- ⚠️ NO es Foreign Key, solo texto
  value DECIMAL(10,2) NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT CHECK (period_type IN ('1-15', '16-31')),
  -- ...
);
```

**Dependencias críticas:**
- ⚠️ **`platform_id` es TEXT, NO Foreign Key** - No hay validación de integridad
- ⚠️ **Datos históricos preservados** - Si se elimina una plataforma, el historial permanece

---

## 🔧 LÓGICA DE CÁLCULO Y FÓRMULAS

### 1. **Función Principal: `computeUsdBrutoForPlatform`**
**Ubicación:** `lib/calculadora/calc.ts` (líneas 69-109)

**Lógica de conversión:**
```typescript
function computeUsdBrutoForPlatform(
  rule: PlatformRule,
  valueInput: number,
  rates: RatesEffective
): number {
  switch (rule.conversionType) {
    case 'usd_cop':        // USD → USD → COP
      let usd = valueInput;
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    
    case 'eur_usd_cop':    // EUR → USD → COP
      let usd = valueInput * rates.EUR_USD;
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    
    case 'gbp_usd_cop':    // GBP → USD → COP
      let usd = valueInput * rates.GBP_USD;
      if (rule.taxFactor !== undefined) usd *= rule.discountFactor;
      return usd;
    
    case 'tokens':         // Tokens → USD → COP
      const tokenRate = rule.tokenRateUsd ?? 0;
      let usd = valueInput * tokenRate;
      if (rule.taxFactor !== undefined) usd *= rule.taxFactor;
      if (rule.discountFactor !== undefined) usd *= rule.discountFactor;
      return usd;
  }
}
```

**Tipos de conversión:**
- `usd_cop`: USD directo (puede tener descuentos/impuestos)
- `eur_usd_cop`: EUR → USD (con tasa de cambio) → COP
- `gbp_usd_cop`: GBP → USD (con tasa de cambio) → COP
- `tokens`: Tokens/Puntos → USD (con token_rate) → COP

---

### 2. **Mapeo de Campos de Base de Datos a Lógica de Cálculo**

**Campos en `calculator_platforms`:**
- `currency` → Determina el `conversionType`:
  - `'USD'` → `'usd_cop'` o `'tokens'` (según si tiene `token_rate`)
  - `'EUR'` → `'eur_usd_cop'`
  - `'GBP'` → `'gbp_usd_cop'`
- `token_rate` → Se usa como `tokenRateUsd` en cálculos de tokens
- `discount_factor` → Se usa como `discountFactor` en cálculos
- `tax_rate` → Se convierte a `taxFactor` (1 - tax_rate) en cálculos
- `direct_payout` → Flag especial para SUPERFOON (100% para modelo)

---

### 3. **Fórmulas Específicas por Plataforma (Hardcoded)**

**Ubicación:** `components/ModelCalculator.tsx` (líneas 232-272)

**Fórmulas hardcoded:**
```typescript
// EUR
if (platform.id === 'big7') {
  usdBruto = platform.value * rates.eur_usd;
  usdModelo = usdBruto * 0.84;  // 16% impuesto
} else if (platform.id === 'mondo') {
  usdBruto = platform.value * rates.eur_usd;
  usdModelo = usdBruto * 0.78;  // 22% descuento
}

// GBP
if (platform.id === 'aw') {
  usdBruto = platform.value * rates.gbp_usd;
  usdModelo = usdBruto * 0.677;  // Factor específico
}

// USD
if (platform.id === 'cmd' || platform.id === 'camlust' || platform.id === 'skypvt') {
  usdModelo = platform.value * 0.75;  // 25% descuento
} else if (platform.id === 'chaturbate' || platform.id === 'myfreecams' || platform.id === 'stripchat') {
  usdModelo = platform.value * 0.05;  // Token rate
} else if (platform.id === 'dxlive') {
  usdModelo = platform.value * 0.60;  // Token rate específico
} else if (platform.id === 'secretfriends') {
  usdModelo = platform.value * 0.5;  // Factor específico
} else if (platform.id === 'superfoon') {
  usdModelo = platform.value;  // 100% directo
}
```

**⚠️ PROBLEMA CRÍTICO:** Las fórmulas están **hardcoded** en múltiples lugares:
- `components/ModelCalculator.tsx`
- `components/AdminModelCalculator.tsx`
- `app/admin/model/calculator/page.tsx`
- `app/api/calculator/unified-productivity/route.ts`
- `lib/calculadora/calc.ts` (versión más genérica)

**Implicación:** Al agregar una nueva plataforma, las fórmulas deben:
1. Estar correctamente configuradas en `calculator_platforms` (currency, token_rate, discount_factor, tax_rate)
2. **O** tener lógica hardcoded en todos los componentes que calculan

---

## 🔗 DEPENDENCIAS Y RELACIONES

### 1. **Integridad Referencial**

**Foreign Keys con CASCADE:**
- `modelo_plataformas.platform_id` → `calculator_platforms.id` **ON DELETE CASCADE**
  - ⚠️ **Si se elimina una plataforma, se eliminan TODAS las relaciones modelo-plataforma**

**Foreign Keys sin validación:**
- `calculator_config.enabled_platforms` (JSONB) - No hay FK, solo array de strings
- `model_values.platform` (TEXT) - No hay FK
- `calculator_history.platform_id` (TEXT) - No hay FK

---

### 2. **APIs que Consumen Plataformas**

#### **GET `/api/calculator/platforms`**
- **Ubicación:** `app/api/calculator/platforms/route.ts`
- **Función:** Obtiene todas las plataformas activas
- **Uso:** Cargar catálogo de plataformas disponibles

#### **GET `/api/calculator/config-v2`**
- **Ubicación:** `app/api/calculator/config-v2/route.ts`
- **Función:** Obtiene configuración de calculadora para un modelo
- **Dependencia:** Filtra plataformas por `enabled_platforms` (array JSONB)
- **⚠️ Si una plataforma no existe, el filtro falla silenciosamente**

#### **POST `/api/calculator/config-v2`**
- **Ubicación:** `app/api/calculator/config-v2/route.ts`
- **Función:** Crea/actualiza configuración de calculadora
- **Validación:** NO valida que las plataformas en `enabled_platforms` existan
- **Efecto secundario:** Crea entradas en `modelo_plataformas` automáticamente

#### **POST `/api/plataformas-catalogo`**
- **Ubicación:** `app/api/plataformas-catalogo/route.ts`
- **Función:** Agrega nueva plataforma al catálogo (solo Super Admin)
- **Validación:** Verifica que el usuario sea `super_admin`
- **Validación:** Verifica que el ID no exista (error 409 si duplicado)
- **⚠️ NO valida campos requeridos para cálculos** (currency, token_rate, etc.)

---

### 3. **Componentes Frontend que Usan Plataformas**

#### **`components/ModelCalculator.tsx`**
- Carga plataformas desde `/api/calculator/config-v2`
- Calcula resultados usando fórmulas hardcoded
- Guarda valores en `model_values`

#### **`components/AdminModelCalculator.tsx`**
- Similar a `ModelCalculator.tsx` pero con vista de admin
- Permite habilitar/deshabilitar plataformas

#### **`app/admin/model/calculator/page.tsx`**
- Vista completa de calculadora para admin
- Muestra todas las plataformas habilitadas
- Calcula usando fórmulas hardcoded

#### **`app/admin/calculator/config/page.tsx`**
- Configuración de calculadora por modelo
- Permite seleccionar plataformas habilitadas
- **⚠️ NO valida que las plataformas existan antes de guardar**

---

## ⚠️ RIESGOS Y PROBLEMAS IDENTIFICADOS

### 1. **Fórmulas Hardcoded en Múltiples Lugares**
**Riesgo:** ALTO
- Las fórmulas están duplicadas en al menos 5 archivos diferentes
- Al agregar una nueva plataforma, debe actualizarse código en múltiples lugares
- **Solución recomendada:** Centralizar lógica de cálculo en `lib/calculadora/calc.ts`

### 2. **Falta de Validación de Integridad en JSONB**
**Riesgo:** MEDIO
- `calculator_config.enabled_platforms` puede contener IDs de plataformas eliminadas
- No hay validación al guardar configuración
- **Solución recomendada:** Validar que todas las plataformas existan antes de guardar

### 3. **Datos Huérfanos en Tablas Históricas**
**Riesgo:** BAJO
- `model_values.platform` y `calculator_history.platform_id` son TEXT sin FK
- Si se elimina una plataforma, los datos históricos quedan con IDs inválidos
- **Solución recomendada:** No eliminar plataformas, solo desactivarlas (`active = false`)

### 4. **CASCADE DELETE en `modelo_plataformas`**
**Riesgo:** ALTO
- Si se elimina una plataforma, se pierden TODAS las relaciones modelo-plataforma
- Puede afectar historial y configuraciones
- **Solución recomendada:** NO permitir eliminación física, solo desactivación

### 5. **Falta de Validación de Campos Requeridos**
**Riesgo:** ALTO
- `POST /api/plataformas-catalogo` no valida que `currency`, `token_rate`, etc. estén presentes
- Una plataforma sin estos campos causará errores en cálculos
- **Solución recomendada:** Validar campos requeridos según el tipo de conversión

### 6. **Inconsistencia en Tipos de Conversión**
**Riesgo:** MEDIO
- El campo `currency` en BD no mapea directamente a `conversionType` en código
- Plataformas con `currency = 'USD'` pueden ser `'usd_cop'` o `'tokens'` según `token_rate`
- **Solución recomendada:** Agregar campo `conversion_type` explícito en BD

---

## ✅ VALIDACIONES NECESARIAS PARA CREAR PLATAFORMA

### 1. **Validaciones de Campos Obligatorios**
```typescript
// Campos siempre requeridos
- id: string (único, no vacío, formato válido)
- name: string (no vacío)
- currency: 'USD' | 'EUR' | 'GBP' (enum válido)
- active: boolean (default: true)

// Campos condicionales según tipo
if (currency === 'USD' && tiene token_rate) {
  - token_rate: number (>= 0, requerido)
} else if (currency === 'USD' && tiene discount_factor) {
  - discount_factor: number (0-1, requerido)
} else if (currency === 'EUR' || currency === 'GBP') {
  - discount_factor o tax_rate: number (opcional pero recomendado)
}
```

### 2. **Validaciones de Integridad**
- ✅ Verificar que `id` no exista ya en `calculator_platforms`
- ✅ Verificar que `id` sea válido (solo letras minúsculas, números, guiones)
- ✅ Verificar que `currency` sea uno de los valores permitidos
- ✅ Verificar que `token_rate`, `discount_factor`, `tax_rate` estén en rangos válidos (0-1 para factores, >0 para rates)

### 3. **Validaciones de Negocio**
- ✅ Si `currency = 'USD'` y `token_rate` está presente, no debe tener `discount_factor` o `tax_rate` (conflicto)
- ✅ Si `direct_payout = true`, no debe tener `discount_factor` o `tax_rate`
- ✅ `payment_frequency` debe ser 'quincenal' o 'mensual' si está presente

---

## 🔄 FLUJO DE CREACIÓN DE PLATAFORMA (Recomendado)

### 1. **Validación Pre-Creación**
```
1. Validar permisos (solo super_admin)
2. Validar campos obligatorios
3. Validar formato de ID
4. Validar que ID no exista
5. Validar lógica de negocio (currency + factores)
```

### 2. **Creación en Base de Datos**
```
1. INSERT en calculator_platforms con todos los campos
2. Verificar que se creó correctamente
3. Retornar plataforma creada
```

### 3. **Sincronización (Opcional)**
```
1. Si hay modelos con configuraciones que podrían usar esta plataforma, notificar
2. NO agregar automáticamente a ninguna configuración
3. Permitir que admins agreguen manualmente
```

---

## 📝 CAMPOS REQUERIDOS POR TIPO DE PLATAFORMA

### **Tipo: Tokens (USD con token_rate)**
```typescript
{
  id: 'chaturbate',
  name: 'Chaturbate',
  currency: 'USD',
  token_rate: 0.05,  // REQUERIDO
  discount_factor: null,
  tax_rate: null,
  direct_payout: false
}
```

### **Tipo: USD con Descuento**
```typescript
{
  id: 'cmd',
  name: 'CMD',
  currency: 'USD',
  token_rate: null,
  discount_factor: 0.75,  // REQUERIDO (25% descuento)
  tax_rate: null,
  direct_payout: false
}
```

### **Tipo: EUR con Impuesto**
```typescript
{
  id: 'big7',
  name: 'BIG7',
  currency: 'EUR',
  token_rate: null,
  discount_factor: null,
  tax_rate: 0.16,  // REQUERIDO (16% impuesto)
  direct_payout: false
}
```

### **Tipo: EUR con Descuento**
```typescript
{
  id: 'mondo',
  name: 'MONDO',
  currency: 'EUR',
  token_rate: null,
  discount_factor: 0.78,  // REQUERIDO (22% descuento)
  tax_rate: null,
  direct_payout: false
}
```

### **Tipo: GBP con Factor**
```typescript
{
  id: 'aw',
  name: 'AW',
  currency: 'GBP',
  token_rate: null,
  discount_factor: 0.677,  // REQUERIDO
  tax_rate: null,
  direct_payout: false
}
```

### **Tipo: Pago Directo 100%**
```typescript
{
  id: 'superfoon',
  name: 'SUPERFOON',
  currency: 'USD',
  token_rate: null,
  discount_factor: null,
  tax_rate: null,
  direct_payout: true  // REQUERIDO
}
```

---

## 🎯 CONCLUSIONES Y RECOMENDACIONES

### **1. Arquitectura Actual**
- ✅ La estructura de base de datos es sólida y permite agregar nuevas plataformas
- ⚠️ Las fórmulas están hardcoded en múltiples lugares (necesita refactorización)
- ⚠️ Falta validación de integridad en algunos puntos críticos

### **2. Para Implementar Creación de Plataformas**
**Requisitos mínimos:**
1. ✅ Validar permisos (solo super_admin)
2. ✅ Validar campos obligatorios según tipo de plataforma
3. ✅ Validar que ID no exista
4. ✅ Validar lógica de negocio (currency + factores)
5. ✅ Insertar en `calculator_platforms`
6. ⚠️ **NO eliminar plataformas, solo desactivarlas** (`active = false`)

**Mejoras recomendadas:**
1. 🔄 Refactorizar fórmulas hardcoded a lógica centralizada
2. 🔄 Agregar campo `conversion_type` explícito en BD
3. 🔄 Validar integridad de `enabled_platforms` en `calculator_config`
4. 🔄 Agregar validación de campos requeridos en API de creación

### **3. Riesgos a Mitigar**
- ⚠️ **ALTO:** Fórmulas hardcoded pueden causar inconsistencias
- ⚠️ **MEDIO:** Datos huérfanos en JSONB si no se valida
- ⚠️ **BAJO:** Historial con IDs inválidos (no crítico, solo histórico)

### **4. Próximos Pasos Sugeridos**
1. Crear endpoint `POST /api/calculator/platforms` con validaciones completas
2. Crear formulario en UI para agregar plataformas (solo super_admin)
3. Agregar validación de integridad en `POST /api/calculator/config-v2`
4. Refactorizar fórmulas hardcoded a función centralizada
5. Agregar tests unitarios para validaciones de plataformas

---

## 📚 ARCHIVOS CLAVE PARA REFERENCIA

- **Esquema BD:** `db/calculadora/calculator_config.sql`
- **Lógica de Cálculo:** `lib/calculadora/calc.ts`
- **API Plataformas:** `app/api/calculator/platforms/route.ts`
- **API Config:** `app/api/calculator/config-v2/route.ts`
- **Componente Calculadora:** `components/ModelCalculator.tsx`
- **Relación Modelo-Plataforma:** `db/modelo_plataformas_schema_optimized.sql`

---

**Fecha de Análisis:** 2025-01-XX  
**Analizado por:** AI Assistant  
**Estado:** ✅ Completo - Listo para implementación

