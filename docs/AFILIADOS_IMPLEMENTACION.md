# 🏢 IMPLEMENTACIÓN: ESTUDIOS AFILIADOS

## 📋 RESUMEN EJECUTIVO

Implementación de sistema de estudios afiliados para AIM, permitiendo que estudios externos operen dentro de su propia "burbuja" mientras Agencia Innova mantiene control total y recibe un porcentaje de su facturación.

## 🏗️ ARQUITECTURA

### Jerarquía
```
Agencia Innova (super_admin)
  └── Estudios Afiliados (superadmin_aff)
      └── Sedes (affiliate_sedes)
          └── Modelos (modelo)
```

### Roles
- **super_admin**: Control total sobre todo el sistema (Agencia Innova)
- **superadmin_aff**: Superadmin del estudio afiliado (nuevo rol)
- **admin**: Gestor de Innova (puede gestionar afiliados) o Admin dentro de afiliado
- **gestor**: Gestor de Agencia Innova (gestiona todo el sistema)
- **modelo**: Modelo (funciona igual, pero dentro de su burbuja)

## 📊 ESTRUCTURA DE BASE DE DATOS

**ARQUITECTURA: Columnas adicionales en tablas existentes (NO tablas separadas)**

### 1. Tabla: `affiliate_studios` (NUEVA)
```sql
CREATE TABLE affiliate_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  commission_percentage DECIMAL(5,2) DEFAULT 10.00, -- Porcentaje personalizable
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) -- Superadmin que creó el estudio
);
```

### 2. Agregar columna `affiliate_studio_id` a tablas existentes

**Tablas que requieren la columna:**
- `users` - Usuarios del afiliado
- `sedes` - Sedes del afiliado (tabla existente)
- `groups` - Grupos del afiliado (si se usan)
- `model_values` - Valores de calculadora
- `calculator_totals` - Totales de calculadora
- `calculator_history` - Historial de calculadora
- `calculator_config` - Configuración de calculadora
- `plataforma_requests` - Solicitudes de plataformas
- `anticipos` - Solicitudes de anticipos
- `rates` - Rates actuales (scope = 'affiliate')
- `gestor_historical_rates` - Rates históricas del afiliado

**Ejemplo de migración:**
```sql
-- Agregar columna a users
ALTER TABLE users 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a sedes
ALTER TABLE sedes 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a groups (si se usa)
ALTER TABLE groups 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a model_values
ALTER TABLE model_values 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a calculator_totals
ALTER TABLE calculator_totals 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a calculator_history
ALTER TABLE calculator_history 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a calculator_config
ALTER TABLE calculator_config 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a plataforma_requests
ALTER TABLE plataforma_requests 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Agregar columna a anticipos
ALTER TABLE anticipos 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX idx_users_affiliate_studio_id ON users(affiliate_studio_id);
CREATE INDEX idx_sedes_affiliate_studio_id ON sedes(affiliate_studio_id);
CREATE INDEX idx_groups_affiliate_studio_id ON groups(affiliate_studio_id);
CREATE INDEX idx_model_values_affiliate_studio_id ON model_values(affiliate_studio_id);
CREATE INDEX idx_calculator_totals_affiliate_studio_id ON calculator_totals(affiliate_studio_id);
CREATE INDEX idx_calculator_history_affiliate_studio_id ON calculator_history(affiliate_studio_id);
CREATE INDEX idx_calculator_config_affiliate_studio_id ON calculator_config(affiliate_studio_id);
CREATE INDEX idx_plataforma_requests_affiliate_studio_id ON plataforma_requests(affiliate_studio_id);
CREATE INDEX idx_anticipos_affiliate_studio_id ON anticipos(affiliate_studio_id);
```

**Nota sobre rates:**
- `rates`: Usar `scope = 'affiliate'` y `scope_id = affiliate_studio_id`
- `gestor_historical_rates`: Agregar columna `affiliate_studio_id` (puede ser NULL para rates globales de Innova)

### 3. Tabla: `affiliate_billing_summary` (NUEVA)
```sql
CREATE TABLE affiliate_billing_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  period_type VARCHAR(10) CHECK (period_type IN ('P1', 'P2')),
  total_usd_bruto DECIMAL(12,2) DEFAULT 0,
  total_usd_affiliate DECIMAL(12,2) DEFAULT 0, -- 90% (o según acuerdo)
  total_usd_innova DECIMAL(12,2) DEFAULT 0, -- 10% (o según acuerdo)
  total_cop_affiliate DECIMAL(12,2) DEFAULT 0,
  total_cop_innova DECIMAL(12,2) DEFAULT 0,
  models_count INTEGER DEFAULT 0,
  sedes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(affiliate_studio_id, period_date, period_type)
);
```

## 🔐 SISTEMA DE PERMISOS

### Superadmin AFF (superadmin_aff)
**Puede:**
- ✅ Crear usuarios (solo para su entorno: admin, modelo)
- ✅ Consultar usuarios (solo su entorno)
- ✅ Definir rates (solo para su entorno - rates propias)
- ✅ Configurar calculadora (solo su entorno)
- ✅ Ver calculadora (solo su entorno)
- ✅ Consultar solicitudes e historial (solo su entorno)
- ✅ Gestionar sedes (solo su entorno)
- ✅ Ver portafolio (solo su entorno)
- ✅ Dashboard sedes (solo su entorno)
- ✅ Crear rooms (solo su entorno)
- ✅ Gestionar anticipos de su entorno

**NO puede:**
- ❌ Crear/editar plataformas del sistema (opción oculta)
- ❌ Ver data de Agencia Innova
- ❌ Ver data de otros afiliados
- ❌ Acceder a configuraciones globales

### Superadmin General (super_admin)
**Puede:**
- ✅ Control absoluto sobre TODO (Agencia Innova + Afiliados)
- ✅ Crear/editar/eliminar estudios afiliados
- ✅ Configurar porcentaje de comisión por afiliado
- ✅ Ver toda la facturación (propia + afiliados)
- ✅ Gestionar usuarios de afiliados
- ✅ Crear/editar plataformas

### Admin (admin)
**Si es admin de Agencia Innova:**
- ✅ Gestionar afiliados (igual que superadmin general)
- ✅ Ver facturación de afiliados
- ✅ Gestionar usuarios de afiliados

**Si es admin dentro de un afiliado:**
- ✅ Mismas funciones que superadmin_aff pero dentro de su burbuja
- ✅ Gestionar usuarios, sedes, calculadora de su afiliado

## 💰 SISTEMA DE FACTURACIÓN

### Cálculo Automático
1. **Facturación del Afiliado**: Se calcula igual que para Agencia Innova
   - Suma de `calculator_totals` o `calculator_history` de modelos del afiliado
   - Por sede y por modelo

2. **Comisión de Agencia Innova**:
   - Porcentaje personalizable por estudio afiliado (`commission_percentage`)
   - Por defecto: 10%
   - Cálculo: `total_usd_bruto * (commission_percentage / 100)`

3. **Registro en `affiliate_billing_summary`**:
   - Se genera automáticamente al cerrar períodos
   - Incluye totales por período (P1/P2)

4. **Visualización en Resumen de Facturación**:
   - Aparece como línea separada: `[Nombre del Estudio] - Afiliado`
   - Muestra el monto de comisión para Agencia Innova

## 🔍 FILTROS Y CONSULTAS

### Principio: "Burbuja de Datos"
Todas las consultas deben filtrar por `affiliate_studio_id`:

1. **Para superadmin_aff**: Solo datos donde `affiliate_studio_id = usuario.affiliate_studio_id`
2. **Para super_admin/admin**: Pueden ver todo (sin filtro) o filtrar por afiliado específico
3. **Para modelo**: Solo sus propios datos (ya implementado)

### Tablas que requieren filtro:
- `users` (usuarios del afiliado)
- `sedes` (sedes del afiliado)
- `model_values` (valores de calculadora)
- `calculator_totals` (totales de calculadora)
- `calculator_history` (historial de calculadora)
- `plataforma_requests` (solicitudes de plataformas)
- `anticipos` (solicitudes de anticipos)
- `calculator_config` (configuración de calculadora)
- `rates_historicas` (rates históricas)

## 📁 ARCHIVOS A MODIFICAR/CREAR

### Nuevos Archivos
1. `app/admin/affiliates/page.tsx` - Gestión de estudios afiliados (superadmin)
2. `app/admin/affiliates/[id]/page.tsx` - Detalle de estudio afiliado
3. `app/admin/affiliates/create/page.tsx` - Crear estudio afiliado
4. `app/api/admin/affiliates/route.ts` - API CRUD de afiliados
5. `app/api/admin/affiliates/[id]/route.ts` - API de detalle de afiliado
6. `lib/affiliates/permissions.ts` - Lógica de permisos para afiliados
7. `lib/affiliates/filters.ts` - Helpers para filtrar por afiliado
8. `lib/affiliates/billing.ts` - Cálculo de facturación de afiliados

### Archivos a Modificar
1. `lib/security/permissions.ts` - Agregar rol `superadmin_aff`
2. `lib/auth-modern.ts` - Agregar validación de permisos de afiliado
3. `app/api/admin/billing-summary/route.ts` - Incluir facturación de afiliados
4. `components/BillingSummary.tsx` - Mostrar líneas de afiliados
5. Todas las APIs que consultan datos (agregar filtro por afiliado)
6. `app/admin/layout.tsx` - Ocultar opciones según rol
7. `app/admin/calculator/platforms/page.tsx` - Ocultar para superadmin_aff

## 🚀 FASES DE IMPLEMENTACIÓN

### Fase 1: Base de Datos y Roles
- [ ] Crear tablas de afiliados
- [ ] Agregar columna `affiliate_studio_id` a `users` y `sedes`
- [ ] Agregar rol `superadmin_aff` al sistema
- [ ] Crear migraciones SQL

### Fase 2: Permisos y Filtros
- [ ] Implementar sistema de permisos para afiliados
- [ ] Crear helpers de filtrado por afiliado
- [ ] Modificar consultas existentes para incluir filtros

### Fase 3: Gestión de Afiliados (UI)
- [ ] Crear página de gestión de afiliados (superadmin)
- [ ] Crear formulario de creación/edición
- [ ] Implementar asignación de usuarios a afiliados

### Fase 4: Facturación
- [ ] Implementar cálculo automático de comisión
- [ ] Modificar resumen de facturación para incluir afiliados
- [ ] Crear tabla `affiliate_billing_summary`

### Fase 5: Restricciones de UI
- [ ] Ocultar opciones según rol (crear plataformas, etc.)
- [ ] Filtrar datos en todas las vistas
- [ ] Ajustar menús según rol

### Fase 6: Testing y Ajustes
- [ ] Probar flujo completo de afiliado
- [ ] Verificar cálculos de facturación
- [ ] Ajustar permisos según necesidades

## ⚠️ CONSIDERACIONES IMPORTANTES

1. **Migración de Datos Existentes**:
   - Los usuarios/sedes existentes tendrán `affiliate_studio_id = NULL` (pertenecen a Agencia Innova)

2. **Backward Compatibility**:
   - Todas las consultas deben funcionar con `affiliate_studio_id IS NULL` (Agencia Innova)

3. **Seguridad**:
   - Implementar RLS (Row Level Security) en Supabase para afiliados
   - Validar permisos en cada endpoint

4. **Performance**:
   - Agregar índices en `affiliate_studio_id` en todas las tablas relevantes

5. **Facturación**:
   - El cálculo debe ejecutarse automáticamente al cerrar períodos
   - Considerar usar el mismo cron job de cierre de períodos

## 📝 NOTAS ADICIONALES

- El porcentaje de comisión es personalizable por estudio afiliado
- Los afiliados pueden tener múltiples sedes
- Cada sede puede tener múltiples modelos
- La facturación se calcula por sede y modelo, luego se agrega el porcentaje
- Los gestores de Innova pueden gestionar afiliados igual que el superadmin general

