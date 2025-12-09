# 📋 PLAN DE IMPLEMENTACIÓN: CREAR PLATAFORMA

## 🎯 OBJETIVO
Implementar funcionalidad para que Super Admin pueda crear nuevas plataformas desde la interfaz, que se integren automáticamente en el flujo existente sin afectar las plataformas actuales.

---

## ✅ PASOS DE IMPLEMENTACIÓN (Orden de Ejecución)

### **FASE 1: PREPARACIÓN Y VALIDACIÓN** ⚠️ CRÍTICO

#### **Paso 1.1: Backup y Verificación**
- [ ] Verificar que todas las plataformas existentes están activas (`active = true`)
- [ ] Documentar estructura actual de `calculator_platforms`
- [ ] Verificar que no hay IDs duplicados

#### **Paso 1.2: Análisis de Dependencias**
- [ ] Verificar que `GET /api/calculator/platforms` funciona correctamente
- [ ] Verificar que `GET /api/calculator/config-v2` carga plataformas correctamente
- [ ] Verificar que "Configurar Calculadora" muestra todas las plataformas activas

---

### **FASE 2: BACKEND - API ENDPOINT** 🔧

#### **Paso 2.1: Extender API de Plataformas**
**Archivo:** `app/api/calculator/platforms/route.ts`

**Agregar método POST:**
```typescript
// POST: Crear nueva plataforma (solo Super Admin)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      id, 
      name, 
      description, 
      currency, 
      token_rate, 
      discount_factor, 
      tax_rate, 
      direct_payout,
      payment_frequency,
      created_by 
    } = body;

    // 1. VALIDACIÓN DE PERMISOS
    if (!created_by) {
      return NextResponse.json({ 
        success: false, 
        error: 'created_by es requerido' 
      }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', created_by)
      .single();

    if (userError || !user || user.role !== 'super_admin') {
      return NextResponse.json({ 
        success: false, 
        error: 'Solo Super Admins pueden crear plataformas' 
      }, { status: 403 });
    }

    // 2. VALIDACIÓN DE CAMPOS OBLIGATORIOS
    if (!id || !name || !currency) {
      return NextResponse.json({ 
        success: false, 
        error: 'id, name y currency son requeridos' 
      }, { status: 400 });
    }

    // 3. VALIDACIÓN DE FORMATO DE ID
    const idRegex = /^[a-z0-9_-]+$/;
    if (!idRegex.test(id.toLowerCase())) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID debe contener solo letras minúsculas, números, guiones y guiones bajos' 
      }, { status: 400 });
    }

    // 4. VALIDACIÓN DE CURRENCY
    const validCurrencies = ['USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      return NextResponse.json({ 
        success: false, 
        error: 'currency debe ser USD, EUR o GBP' 
      }, { status: 400 });
    }

    // 5. VALIDACIÓN DE ID ÚNICO
    const { data: existingPlatform, error: checkError } = await supabase
      .from('calculator_platforms')
      .select('id')
      .eq('id', id.toLowerCase())
      .single();

    if (existingPlatform) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ya existe una plataforma con ese ID' 
      }, { status: 409 });
    }

    // 6. VALIDACIÓN DE LÓGICA DE NEGOCIO
    const normalizedCurrency = currency.toUpperCase();
    const hasTokenRate = token_rate !== null && token_rate !== undefined;
    const hasDiscountFactor = discount_factor !== null && discount_factor !== undefined;
    const hasTaxRate = tax_rate !== null && tax_rate !== undefined;
    const isDirectPayout = direct_payout === true;

    // Validar según tipo de plataforma
    if (normalizedCurrency === 'USD' && hasTokenRate) {
      // Tipo: Tokens
      if (hasDiscountFactor || hasTaxRate) {
        return NextResponse.json({ 
          success: false, 
          error: 'Plataformas con token_rate no pueden tener discount_factor o tax_rate' 
        }, { status: 400 });
      }
      if (token_rate <= 0 || token_rate > 1) {
        return NextResponse.json({ 
          success: false, 
          error: 'token_rate debe estar entre 0 y 1' 
        }, { status: 400 });
      }
    } else if (normalizedCurrency === 'USD' && !hasTokenRate) {
      // Tipo: USD con descuento o directo
      if (isDirectPayout && (hasDiscountFactor || hasTaxRate)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Plataformas con direct_payout no pueden tener discount_factor o tax_rate' 
        }, { status: 400 });
      }
      if (hasDiscountFactor && (discount_factor <= 0 || discount_factor > 1)) {
        return NextResponse.json({ 
          success: false, 
          error: 'discount_factor debe estar entre 0 y 1' 
        }, { status: 400 });
      }
    } else if (normalizedCurrency === 'EUR' || normalizedCurrency === 'GBP') {
      // Tipo: EUR o GBP
      if (hasTokenRate) {
        return NextResponse.json({ 
          success: false, 
          error: 'Plataformas EUR/GBP no pueden tener token_rate' 
        }, { status: 400 });
      }
      if (hasDiscountFactor && (discount_factor <= 0 || discount_factor > 1)) {
        return NextResponse.json({ 
          success: false, 
          error: 'discount_factor debe estar entre 0 y 1' 
        }, { status: 400 });
      }
      if (hasTaxRate && (tax_rate < 0 || tax_rate > 1)) {
        return NextResponse.json({ 
          success: false, 
          error: 'tax_rate debe estar entre 0 y 1' 
        }, { status: 400 });
      }
    }

    // 7. VALIDACIÓN DE PAYMENT_FREQUENCY
    if (payment_frequency && !['quincenal', 'mensual'].includes(payment_frequency)) {
      return NextResponse.json({ 
        success: false, 
        error: 'payment_frequency debe ser "quincenal" o "mensual"' 
      }, { status: 400 });
    }

    // 8. CREAR PLATAFORMA
    const platformData = {
      id: id.toLowerCase(),
      name: name.trim(),
      description: description?.trim() || null,
      currency: normalizedCurrency,
      token_rate: hasTokenRate ? Number(token_rate) : null,
      discount_factor: hasDiscountFactor ? Number(discount_factor) : null,
      tax_rate: hasTaxRate ? Number(tax_rate) : null,
      direct_payout: isDirectPayout || false,
      payment_frequency: payment_frequency || 'quincenal',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newPlatform, error: insertError } = await supabase
      .from('calculator_platforms')
      .insert(platformData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ [API-PLATFORMS] Error al crear plataforma:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: insertError.message || 'Error al crear plataforma' 
      }, { status: 500 });
    }

    console.log('✅ [API-PLATFORMS] Plataforma creada exitosamente:', newPlatform.id);

    return NextResponse.json({ 
      success: true, 
      platform: newPlatform,
      message: 'Plataforma creada exitosamente' 
    });

  } catch (error: any) {
    console.error('❌ [API-PLATFORMS] Error en POST:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 });
  }
}
```

**Validaciones implementadas:**
- ✅ Permisos (solo super_admin)
- ✅ Campos obligatorios
- ✅ Formato de ID
- ✅ Currency válido
- ✅ ID único
- ✅ Lógica de negocio (currency + factores)
- ✅ Rangos válidos para factores
- ✅ Payment frequency válido

---

### **FASE 3: FRONTEND - PÁGINA DE CREACIÓN** 🎨

#### **Paso 3.1: Crear Página de Creación de Plataforma**
**Archivo:** `app/admin/calculator/create-platform/page.tsx`

**Estructura:**
```typescript
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PlatformType = 'tokens' | 'credits' | 'currency' | 'direct';

export default function CreatePlatformPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Estados del formulario
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    type: 'tokens' as PlatformType,
    currency: 'USD',
    token_rate: '',
    discount_factor: '',
    tax_rate: '',
    direct_payout: false,
    payment_frequency: 'quincenal'
  });

  // Validar autenticación y permisos
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single();

      if (userData?.role !== 'super_admin') {
        router.push('/admin/dashboard');
        return;
      }

      setCurrentUser(userData);
      setAuthLoading(false);
    }
    checkAuth();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Preparar datos según tipo
      const platformData: any = {
        id: formData.id.toLowerCase().trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        currency: formData.currency,
        payment_frequency: formData.payment_frequency,
        direct_payout: formData.direct_payout,
        created_by: currentUser.id
      };

      // Agregar campos según tipo
      if (formData.type === 'tokens') {
        platformData.token_rate = parseFloat(formData.token_rate);
        platformData.discount_factor = null;
        platformData.tax_rate = null;
      } else if (formData.type === 'credits') {
        platformData.discount_factor = parseFloat(formData.discount_factor);
        platformData.token_rate = null;
        platformData.tax_rate = null;
      } else if (formData.type === 'currency') {
        if (formData.discount_factor) {
          platformData.discount_factor = parseFloat(formData.discount_factor);
        }
        if (formData.tax_rate) {
          platformData.tax_rate = parseFloat(formData.tax_rate);
        }
        platformData.token_rate = null;
      } else if (formData.type === 'direct') {
        platformData.direct_payout = true;
        platformData.token_rate = null;
        platformData.discount_factor = null;
        platformData.tax_rate = null;
      }

      const response = await fetch('/api/calculator/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platformData)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al crear plataforma');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/calculator/config');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Error al crear plataforma');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            Crear Nueva Plataforma
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Define los criterios y fórmulas de conversión para la nueva plataforma
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Información Básica</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">ID de Plataforma *</label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="ej: nuevaplataforma"
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                  pattern="[a-z0-9_-]+"
                />
                <p className="text-xs text-gray-500 mt-1">Solo letras minúsculas, números, guiones y guiones bajos</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ej: Nueva Plataforma"
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional de la plataforma"
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Tipo y Configuración */}
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Tipo y Fórmula de Conversión</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Plataforma *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as PlatformType })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="tokens">Tokens (ej: Chaturbate, MyFreeCams)</option>
                  <option value="credits">Créditos con Descuento (ej: CMD, Camlust)</option>
                  <option value="currency">Divisa (EUR/GBP) con Impuestos/Descuentos</option>
                  <option value="direct">Pago Directo 100% (ej: SUPERFOON)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Moneda Base *</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="USD">USD (Dólar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (Libra Esterlina)</option>
                </select>
              </div>

              {/* Campos condicionales según tipo */}
              {formData.type === 'tokens' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Tasa de Conversión de Tokens *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    value={formData.token_rate}
                    onChange={(e) => setFormData({ ...formData, token_rate: e.target.value })}
                    placeholder="ej: 0.05 (100 tokens = 5 USD)"
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">USD por 1 token (ej: 0.05 significa 100 tokens = 5 USD)</p>
                </div>
              )}

              {formData.type === 'credits' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Factor de Descuento *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.discount_factor}
                    onChange={(e) => setFormData({ ...formData, discount_factor: e.target.value })}
                    placeholder="ej: 0.75 (25% descuento)"
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Factor multiplicador (0.75 = 75% del valor, 25% descuento)</p>
                </div>
              )}

              {formData.type === 'currency' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Factor de Descuento (Opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formData.discount_factor}
                      onChange={(e) => setFormData({ ...formData, discount_factor: e.target.value })}
                      placeholder="ej: 0.78 (22% descuento)"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tasa de Impuesto (Opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      placeholder="ej: 0.16 (16% impuesto)"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Tasa de impuesto (0.16 = 16% impuesto, se aplica como 1 - 0.16 = 0.84)</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Frecuencia de Pago</label>
                <select
                  value={formData.payment_frequency}
                  onChange={(e) => setFormData({ ...formData, payment_frequency: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mensajes de Error/Success */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">
                ✅ Plataforma creada exitosamente. Redirigiendo...
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Plataforma'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

### **FASE 4: MENÚ Y NAVEGACIÓN** 🧭

#### **Paso 4.1: Agregar Opción en Menú (Solo Super Admin)**
**Archivos a modificar:**
1. `lib/menu-config.tsx`
2. `app/admin/layout.tsx`
3. `app/superadmin/layout.tsx`

**En `lib/menu-config.tsx` (línea ~90):**
```typescript
{
  id: 'calculator',
  label: 'Gestión Calculadora',
  href: '#',
  subItems: [
    { 
      label: 'Definir RATES', 
      href: '/admin/rates',
      // ... icon existente
    },
    { 
      label: 'Crear Plataforma',  // ⭐ NUEVO
      href: '/admin/calculator/create-platform',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      description: 'Crear nueva plataforma para el sistema',
      // ⚠️ Solo visible para super_admin
    },
    { 
      label: 'Configurar Calculadora', 
      href: '/admin/calculator/config',
      // ... icon existente
    },
    // ... resto de opciones
  ]
}
```

**En `app/admin/layout.tsx` y `app/superadmin/layout.tsx`:**
- Agregar la misma opción en el menú dinámico
- **IMPORTANTE:** Solo mostrar "Crear Plataforma" si `userRole === 'super_admin'`

---

### **FASE 5: INTEGRACIÓN AUTOMÁTICA** 🔄

#### **Paso 5.1: Verificar Integración Automática**
**Archivo:** `app/admin/calculator/config/page.tsx`

**Verificación:**
- ✅ La página ya carga plataformas desde `/api/calculator/platforms`
- ✅ El endpoint GET ya filtra por `active = true`
- ✅ Las nuevas plataformas aparecerán automáticamente al recargar

**No se requiere modificación** - La integración es automática porque:
1. `GET /api/calculator/platforms` retorna todas las plataformas con `active = true`
2. La página "Configurar Calculadora" carga desde ese endpoint
3. Las nuevas plataformas creadas tienen `active = true` por defecto

---

### **FASE 6: VALIDACIÓN Y PRUEBAS** ✅

#### **Paso 6.1: Pruebas de Creación**
- [ ] Crear plataforma tipo "Tokens" (ej: `test_tokens`)
- [ ] Crear plataforma tipo "Créditos" (ej: `test_credits`)
- [ ] Crear plataforma tipo "Divisa EUR" (ej: `test_eur`)
- [ ] Crear plataforma tipo "Pago Directo" (ej: `test_direct`)
- [ ] Verificar que todas aparecen en "Configurar Calculadora"
- [ ] Verificar que se pueden seleccionar para modelos

#### **Paso 6.2: Pruebas de Validación**
- [ ] Intentar crear plataforma con ID duplicado (debe fallar)
- [ ] Intentar crear plataforma con campos inválidos (debe fallar)
- [ ] Intentar crear plataforma sin permisos (debe fallar)
- [ ] Verificar que plataformas existentes siguen funcionando

#### **Paso 6.3: Pruebas de Integración**
- [ ] Seleccionar nueva plataforma en "Configurar Calculadora"
- [ ] Verificar que aparece en "Mi Calculadora" de la modelo
- [ ] Ingresar valores y verificar que calcula correctamente
- [ ] Verificar que se guarda en `model_values`
- [ ] Verificar que aparece en historial

---

### **FASE 7: SEGURIDAD Y ROLLBACK** 🛡️

#### **Paso 7.1: Medidas de Seguridad**
- ✅ Validación de permisos en backend (solo super_admin)
- ✅ Validación de permisos en frontend (redirige si no es super_admin)
- ✅ Validación de integridad de datos
- ✅ Validación de lógica de negocio
- ✅ No se pueden eliminar plataformas (solo desactivar)

#### **Paso 7.2: Plan de Rollback**
Si algo falla:
1. **NO eliminar plataformas creadas** - Solo desactivarlas:
   ```sql
   UPDATE calculator_platforms 
   SET active = false 
   WHERE id = 'plataforma_problematica';
   ```
2. **Revertir cambios de código:**
   - Eliminar opción del menú
   - Eliminar página de creación
   - Mantener endpoint POST (puede quedar para uso futuro)

---

## 📝 CHECKLIST FINAL

### **Antes de Deploy a Producción:**
- [ ] Todas las validaciones funcionan correctamente
- [ ] Pruebas completadas en ambiente de desarrollo
- [ ] Documentación actualizada
- [ ] Backup de base de datos realizado
- [ ] Verificado que plataformas existentes siguen funcionando
- [ ] Verificado que nuevas plataformas aparecen en "Configurar Calculadora"
- [ ] Verificado que se pueden usar en calculadoras de modelos

### **Post-Deploy:**
- [ ] Monitorear logs de errores
- [ ] Verificar que Super Admin puede crear plataformas
- [ ] Verificar que nuevas plataformas aparecen correctamente
- [ ] Verificar que cálculos funcionan correctamente

---

## 🎯 RESUMEN DE ARCHIVOS A CREAR/MODIFICAR

### **Nuevos Archivos:**
1. ✅ `app/admin/calculator/create-platform/page.tsx` - Página de creación

### **Archivos a Modificar:**
1. ✅ `app/api/calculator/platforms/route.ts` - Agregar método POST
2. ✅ `lib/menu-config.tsx` - Agregar opción en menú
3. ✅ `app/admin/layout.tsx` - Agregar opción en menú (solo super_admin)
4. ✅ `app/superadmin/layout.tsx` - Agregar opción en menú (solo super_admin)

### **Archivos que NO se Modifican (Integración Automática):**
- ✅ `app/admin/calculator/config/page.tsx` - Ya carga plataformas automáticamente
- ✅ `app/api/calculator/config-v2/route.ts` - Ya funciona con nuevas plataformas
- ✅ `components/ModelCalculator.tsx` - Ya funciona con nuevas plataformas

---

## ⚠️ IMPORTANTE: NO AFECTAR PLATAFORMAS EXISTENTES

### **Garantías:**
1. ✅ **No se modifica estructura de BD** - Solo INSERTs nuevos
2. ✅ **No se modifica lógica de cálculo existente** - Solo se agregan nuevas plataformas
3. ✅ **No se modifica flujo de "Configurar Calculadora"** - Solo se agregan opciones
4. ✅ **Validaciones previenen conflictos** - ID único, validación de campos
5. ✅ **Rollback seguro** - Solo desactivar plataformas nuevas si hay problemas

---

**Estado:** ✅ Plan Completo - Listo para Implementación  
**Prioridad:** 🔴 ALTA - Sistema en Producción  
**Riesgo:** 🟢 BAJO - Cambios no invasivos, validaciones completas

