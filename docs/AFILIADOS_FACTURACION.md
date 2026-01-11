# 💰 SISTEMA DE FACTURACIÓN: ESTUDIOS AFILIADOS

## 📋 ÍNDICE

1. [Distribución de Facturación](#distribución-de-facturación)
2. [Cálculo Automático](#cálculo-automático)
3. [Visualización](#visualización)
4. [Comisiones](#comisiones)
5. [Ejemplos](#ejemplos)

---

## 💵 DISTRIBUCIÓN DE FACTURACIÓN

### Para Modelos de Estudios Afiliados

**Distribución del Bruto (100%):**
- **Modelo**: 60% del bruto
- **Estudio Afiliado**: 30% del bruto (neto para el estudio)
- **Agencia Innova**: 10% del bruto (comisión)

**Nota importante:** El 10% de comisión para Agencia Innova es **asumido por el afiliado**, no se descuenta del bruto del modelo.

### Ejemplo Práctico

Si un modelo genera **$100 USD Bruto**:

```
USD Bruto:           $100.00
├─ Modelo (60%):     $60.00
├─ Estudio (30%):    $30.00
└─ Innova (10%):     $10.00
```

**Desde la perspectiva del afiliado:**
- El afiliado recibe $90.00 (90% del bruto)
- De esos $90.00:
  - $60.00 van para el modelo
  - $30.00 quedan para el estudio
- El afiliado asume los $10.00 de comisión a Innova

---

## 🔢 CÁLCULO AUTOMÁTICO

### Fuente de Datos

El sistema calcula la facturación desde:
1. **Período activo**: `calculator_totals` (datos en tiempo real)
2. **Períodos cerrados**: `calculator_history` (datos históricos)

### Proceso de Cálculo

**Paso 1: Obtener Facturación Bruta**
```typescript
// Suma de todos los valores USD bruto del modelo
const usdBruto = totals.reduce((sum, t) => sum + (t.total_usd_bruto || 0), 0);
```

**Paso 2: Calcular Distribución (para afiliados)**
```typescript
// Modelo: 60% del bruto
const usdModelo = usdBruto * 0.60;

// Estudio Afiliado: 30% del bruto
const usdSede = usdBruto * 0.30;

// Agencia Innova: 10% del bruto (comisión)
const usdInnova = usdBruto * 0.10;
```

**Paso 3: Convertir a COP**
```typescript
const copModelo = usdModelo * usdCopRate;
const copSede = usdSede * usdCopRate;
const copInnova = usdInnova * usdCopRate;
```

### Identificación de Modelos Afiliados

El sistema identifica modelos de afiliados por:
- `users.affiliate_studio_id IS NOT NULL`
- O si el usuario que consulta es `superadmin_aff`

---

## 📊 VISUALIZACIÓN

### Dashboard de Super Admin (Agencia Innova)

**Resumen General:**
```
USD Bruto Total:     $10,000.00
├─ Agencia Innova:  $8,000.00
└─ Afiliados:       $2,000.00
   └─ Comisión:     $200.00 (10% de $2,000)
```

**Desglose por Estudio:**
```
Agencia Innova
├─ Sede 1: $5,000.00
├─ Sede 2: $3,000.00
└─ Total:  $8,000.00

Estudio XYZ - Afiliado
├─ Sede Sur: $2,000.00
│  ├─ Modelo 1: $1,200.00 (60%)
│  └─ Estudio: $600.00 (30%)
└─ Comisión Innova: $200.00 (10%)
```

### Dashboard de Superadmin AFF

**Resumen del Estudio:**
```
USD Bruto Total:        $2,000.00
USD Afiliado (90%):     $1,800.00
USD Comisión Innova:    $200.00 (10%)
```

**Desglose:**
```
Estudio XYZ
├─ Sede Sur: $2,000.00
│  ├─ USD Bruto: $2,000.00
│  ├─ USD Modelo: $1,200.00 (60%)
│  └─ USD Estudio: $600.00 (30%)
└─ Total COP: $7,800,000.00
```

**Nota:** El "USD Afiliado" muestra el 90% del bruto (bruto - comisión Innova), que es lo que el afiliado maneja internamente.

---

## 💼 COMISIONES

### Porcentaje Personalizable

Cada estudio afiliado puede tener un porcentaje de comisión diferente:

```sql
SELECT name, commission_percentage 
FROM affiliate_studios;

-- Resultado:
-- Estudio A: 10.00%
-- Estudio B: 12.50%
-- Estudio C: 8.00%
```

### Configuración de Comisión

**Al crear el estudio:**
```json
{
  "name": "Estudio XYZ",
  "commission_percentage": 10.00
}
```

**Al actualizar:**
```json
PUT /api/admin/affiliates/[id]
{
  "commission_percentage": 12.50
}
```

### Cálculo de Comisión

```typescript
const commissionPercentage = studio.commission_percentage || 10.00;
const usdInnova = usdBruto * (commissionPercentage / 100);
const usdAfiliado = usdBruto - usdInnova; // Lo que maneja el afiliado
```

---

## 📈 EJEMPLOS

### Ejemplo 1: Modelo Único

**Datos:**
- Modelo: "modelo@estudio.com"
- Bruto generado: $1,000.00 USD
- Estudio: "Estudio XYZ" (10% comisión)

**Cálculo:**
```
USD Bruto:           $1,000.00
├─ Modelo (60%):     $600.00
├─ Estudio (30%):    $300.00
└─ Innova (10%):     $100.00
```

**Visualización en Dashboard AFF:**
```
USD Bruto Total:        $1,000.00
USD Afiliado (90%):     $900.00
USD Comisión Innova:    $100.00
```

### Ejemplo 2: Múltiples Modelos

**Datos:**
- Modelo 1: $500.00
- Modelo 2: $300.00
- Modelo 3: $200.00
- Total Bruto: $1,000.00

**Cálculo por Modelo:**
```
Modelo 1:
├─ Bruto: $500.00
├─ Modelo: $300.00 (60%)
├─ Estudio: $150.00 (30%)
└─ Innova: $50.00 (10%)

Modelo 2:
├─ Bruto: $300.00
├─ Modelo: $180.00 (60%)
├─ Estudio: $90.00 (30%)
└─ Innova: $30.00 (10%)

Modelo 3:
├─ Bruto: $200.00
├─ Modelo: $120.00 (60%)
├─ Estudio: $60.00 (30%)
└─ Innova: $20.00 (10%)
```

**Totales:**
```
Total Bruto:        $1,000.00
Total Modelo:       $600.00 (60%)
Total Estudio:      $300.00 (30%)
Total Innova:       $100.00 (10%)
```

### Ejemplo 3: Múltiples Sedes

**Datos:**
- Sede Sur:
  - Modelo 1: $600.00
  - Modelo 2: $400.00
  - Total: $1,000.00
- Sede Norte:
  - Modelo 3: $500.00
  - Total: $500.00

**Cálculo por Sede:**
```
Sede Sur:
├─ Bruto: $1,000.00
├─ Modelo: $600.00 (60%)
├─ Estudio: $300.00 (30%)
└─ Innova: $100.00 (10%)

Sede Norte:
├─ Bruto: $500.00
├─ Modelo: $300.00 (60%)
├─ Estudio: $150.00 (30%)
└─ Innova: $50.00 (10%)
```

**Totales del Estudio:**
```
Total Bruto:        $1,500.00
Total Modelo:       $900.00 (60%)
Total Estudio:      $450.00 (30%)
Total Innova:       $150.00 (10%)
```

---

## 🔍 VERIFICACIÓN

### Verificar Cálculos

**Desde Super Admin:**
1. Ir a `/admin/sedes/dashboard`
2. Verificar que cada afiliado muestra:
   - Total bruto del afiliado
   - Comisión de Innova (10% o según configuración)
   - Desglose por sedes y modelos

**Desde Superadmin AFF:**
1. Ir a `/admin/sedes/dashboard`
2. Verificar que muestra:
   - Total bruto del estudio
   - "USD Afiliado" (90% del bruto)
   - "USD Comisión Innova" (10% del bruto)
   - Desglose por sedes y modelos

### Validar Lógica

**Fórmula de verificación:**
```
USD Bruto = USD Modelo + USD Estudio + USD Innova
USD Modelo = USD Bruto * 0.60
USD Estudio = USD Bruto * 0.30
USD Innova = USD Bruto * 0.10
```

**Ejemplo:**
```
Si USD Bruto = $100.00:
├─ USD Modelo = $100.00 * 0.60 = $60.00 ✅
├─ USD Estudio = $100.00 * 0.30 = $30.00 ✅
├─ USD Innova = $100.00 * 0.10 = $10.00 ✅
└─ Total = $60.00 + $30.00 + $10.00 = $100.00 ✅
```

---

## ⚠️ NOTAS IMPORTANTES

1. **El 10% de comisión es asumido por el afiliado**: No se descuenta del bruto del modelo
2. **El modelo siempre recibe 60%**: Independientemente del porcentaje de comisión configurado
3. **El estudio recibe 30%**: El neto después de pagar al modelo
4. **Innova recibe 10%**: Comisión sobre el bruto total
5. **Los cálculos son automáticos**: Se actualizan en tiempo real desde `calculator_totals`

---

**Última actualización:** Enero 2025
