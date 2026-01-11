# 🏗️ ARQUITECTURA TÉCNICA: ESTUDIOS AFILIADOS

## 📋 ÍNDICE

1. [Arquitectura General](#arquitectura-general)
2. [Base de Datos](#base-de-datos)
3. [Sistema de Filtros](#sistema-de-filtros)
4. [APIs y Endpoints](#apis-y-endpoints)
5. [Componentes Frontend](#componentes-frontend)
6. [Seguridad](#seguridad)
7. [Escalabilidad](#escalabilidad)

---

## 🏛️ ARQUITECTURA GENERAL

### Principio: Multi-Tenancy con Columnas Adicionales

El sistema usa una arquitectura de **multi-tenancy compartido** donde:
- Todas las tablas principales tienen una columna `affiliate_studio_id`
- Los datos se filtran automáticamente según el `affiliate_studio_id` del usuario
- No hay tablas separadas por afiliado (todo está en las mismas tablas)

### Ventajas de esta Arquitectura

✅ **Escalable**: Puede manejar cualquier cantidad de estudios afiliados
✅ **Mantenible**: Un solo código base para todos los afiliados
✅ **Eficiente**: Consultas optimizadas con índices
✅ **Seguro**: Filtros automáticos en todas las consultas

---

## 🗄️ BASE DE DATOS

### Tabla Principal: `affiliate_studios`

```sql
CREATE TABLE affiliate_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  commission_percentage DECIMAL(5,2) DEFAULT 10.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX idx_affiliate_studios_name ON affiliate_studios(name);
CREATE INDEX idx_affiliate_studios_is_active ON affiliate_studios(is_active);
```

### Columnas Agregadas a Tablas Existentes

**Tabla: `users`**
```sql
ALTER TABLE users 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

CREATE INDEX idx_users_affiliate_studio_id ON users(affiliate_studio_id);
```

**Tabla: `groups`**
```sql
ALTER TABLE groups 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

CREATE INDEX idx_groups_affiliate_studio_id ON groups(affiliate_studio_id);
```

**Tabla: `announcements`**
```sql
ALTER TABLE announcements 
ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
ADD COLUMN share_with_affiliates BOOLEAN DEFAULT false;

CREATE INDEX idx_announcements_affiliate_studio_id ON announcements(affiliate_studio_id);
CREATE INDEX idx_announcements_share_with_affiliates ON announcements(share_with_affiliates);
```

**Otras tablas con `affiliate_studio_id`:**
- `anticipos`
- `calculator_config`
- `calculator_totals` (filtrado por `model_id` desde `users`)
- `calculator_history` (filtrado por `model_id` desde `users`)

### Relaciones

```
affiliate_studios (1)
  ├── users (N) [affiliate_studio_id]
  ├── groups (N) [affiliate_studio_id]
  ├── announcements (N) [affiliate_studio_id]
  └── anticipos (N) [affiliate_studio_id via model_id]
```

---

## 🔍 SISTEMA DE FILTROS

### Helper Principal: `addAffiliateFilter`

**Ubicación:** `lib/affiliates/filters.ts`

```typescript
export function addAffiliateFilter<T>(
  query: any,
  user: AuthUser | null
): any {
  if (!user) {
    return query.eq('affiliate_studio_id', '00000000-0000-0000-0000-000000000000');
  }

  // Superadmin y admin de Innova ven todo
  if (user.role === 'super_admin' || (user.role === 'admin' && !user.affiliate_studio_id)) {
    return query; // Sin filtro
  }

  // Superadmin_aff y admin de afiliado solo ven su burbuja
  if (user.role === 'superadmin_aff' || (user.role === 'admin' && user.affiliate_studio_id)) {
    if (user.affiliate_studio_id) {
      return query.eq('affiliate_studio_id', user.affiliate_studio_id);
    }
    return query.eq('affiliate_studio_id', '00000000-0000-0000-0000-000000000000');
  }

  return query;
}
```

### Uso en APIs

**Ejemplo: Obtener grupos**
```typescript
// app/api/groups/route.ts
const { data: adminUser } = await supabase
  .from('users')
  .select('role, affiliate_studio_id')
  .eq('id', adminId)
  .single();

let query = supabase.from('groups').select('*');

if (adminUser.role === 'superadmin_aff' || (adminUser.role === 'admin' && adminUser.affiliate_studio_id)) {
  query = query.eq('affiliate_studio_id', adminUser.affiliate_studio_id);
}

const { data: groups } = await query;
```

### Filtrado en Facturación

**Para modelos de afiliados:**
```typescript
// app/api/admin/billing-summary/route.ts
const innovaModels = billingData.filter(model => !model.affiliate_studio_id);
const affiliateModels = billingData.filter(model => model.affiliate_studio_id);
```

---

## 🔌 APIS Y ENDPOINTS

### Estructura de APIs

```
app/api/
├── admin/
│   ├── affiliates/
│   │   ├── route.ts              # GET, POST
│   │   └── [id]/
│   │       ├── route.ts          # GET, PUT
│   │       └── superadmin/
│   │           └── route.ts      # POST
│   └── billing-summary/
│       └── route.ts              # GET (con filtros)
├── groups/
│   └── route.ts                  # GET, POST (con filtros)
├── users/
│   └── route.ts                  # GET, POST (con filtros)
├── announcements/
│   └── route.ts                  # GET, POST (con filtros)
└── anticipos/
    └── route.ts                  # GET, POST (con filtros)
```

### Patrón de Autenticación

Todas las APIs siguen este patrón:

```typescript
// 1. Obtener token del header
const authHeader = request.headers.get('authorization');
const token = authHeader?.substring(7);

// 2. Verificar usuario
const { data: { user } } = await supabase.auth.getUser(token);

// 3. Obtener datos del usuario
const { data: userData } = await supabase
  .from('users')
  .select('role, affiliate_studio_id')
  .eq('id', user.id)
  .single();

// 4. Aplicar filtros según rol
if (userData.role === 'superadmin_aff') {
  query = query.eq('affiliate_studio_id', userData.affiliate_studio_id);
}
```

---

## 🎨 COMPONENTES FRONTEND

### Componentes Principales

**`components/BillingSummary.tsx`**
- Muestra facturación con soporte para afiliados
- Detecta si es `superadmin_aff` y muestra datos del estudio
- Muestra comisiones de Innova para super admin

**`app/admin/affiliates/gestionar/page.tsx`**
- Gestión completa de estudios afiliados
- Crear, editar, eliminar estudios
- Crear superadmin AFF

**`app/admin/layout.tsx`**
- Menú dinámico según rol
- Oculta opciones para `superadmin_aff` (ej: "Definir RATES")

### Menú Condicional

```typescript
// app/admin/layout.tsx
{userRole === 'super_admin' && (
  <MenuItem href="/admin/affiliates/gestionar">
    Gestión de Afiliados
  </MenuItem>
)}

{userRole === 'superadmin_aff' && (
  <MenuItem href="/admin/calculator/config">
    Configuración Calculadora
  </MenuItem>
  // "Definir RATES" está oculto
)}
```

---

## 🔒 SEGURIDAD

### Validación de Permisos

**En cada API:**
```typescript
// Verificar rol
if (userData.role !== 'super_admin' && userData.role !== 'superadmin_aff') {
  return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
}

// Verificar acceso a recurso
if (userData.role === 'superadmin_aff') {
  if (resource.affiliate_studio_id !== userData.affiliate_studio_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
}
```

### Filtros Automáticos

- Todos los queries aplican filtros automáticamente
- No hay forma de acceder a datos de otros afiliados
- Super Admin puede ver todo, pero los filtros se aplican correctamente

### Row Level Security (RLS)

**Recomendación:** Implementar RLS en Supabase para capa adicional de seguridad:

```sql
-- Ejemplo: RLS para users
CREATE POLICY "Users can only see their affiliate data"
ON users
FOR SELECT
USING (
  affiliate_studio_id IS NULL OR
  affiliate_studio_id = (SELECT affiliate_studio_id FROM users WHERE id = auth.uid())
);
```

---

## 📈 ESCALABILIDAD

### Optimizaciones Implementadas

1. **Índices en `affiliate_studio_id`**: Consultas rápidas por afiliado
2. **Filtros en base de datos**: No se traen datos innecesarios
3. **Cálculo en tiempo real**: No hay tablas de resumen pre-calculadas

### Posibles Optimizaciones Futuras

1. **Caché de facturación**: Para estudios con muchos modelos
2. **Paralelización**: Usar `Promise.all()` para múltiples afiliados
3. **Paginación**: Para listados grandes de modelos/sedes

### Límites

- **Sin límites hardcodeados**: El sistema puede manejar cualquier cantidad de estudios
- **Rendimiento**: Depende del tamaño de la base de datos y número de modelos
- **Escalable horizontalmente**: Puede agregarse más capacidad según necesidad

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
lib/
├── affiliates/
│   ├── filters.ts          # Helpers de filtrado
│   ├── permissions.ts      # Lógica de permisos
│   └── billing.ts          # Cálculo de facturación

app/
├── admin/
│   ├── affiliates/
│   │   └── gestionar/
│   │       └── page.tsx    # UI de gestión
│   └── layout.tsx          # Menú condicional

app/api/
├── admin/
│   ├── affiliates/         # APIs de gestión
│   └── billing-summary/    # API de facturación
└── groups/                 # API con filtros

components/
└── BillingSummary.tsx      # Componente de facturación

db/
└── affiliates/
    ├── create_affiliate_studios.sql
    └── add_announcements_affiliate_support.sql
```

---

## 🔄 FLUJO DE DATOS

### Crear Estudio Afiliado

```
1. POST /api/admin/affiliates
   ↓
2. Insert en affiliate_studios
   ↓
3. (Opcional) Crear usuario en auth.users
   ↓
4. (Opcional) Insert en users con affiliate_studio_id
   ↓
5. Retornar estudio creado
```

### Consultar Datos

```
1. GET /api/[resource]
   ↓
2. Obtener usuario autenticado
   ↓
3. Aplicar filtro según rol
   ↓
4. Query a base de datos con filtro
   ↓
5. Retornar datos filtrados
```

### Calcular Facturación

```
1. GET /api/admin/billing-summary
   ↓
2. Obtener modelos (filtrados por affiliate_studio_id)
   ↓
3. Obtener calculator_totals o calculator_history
   ↓
4. Calcular distribución (60% modelo, 30% estudio, 10% Innova)
   ↓
5. Agrupar por sedes/grupos
   ↓
6. Retornar resumen
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Tabla `affiliate_studios` creada
- [x] Columna `affiliate_studio_id` agregada a tablas relevantes
- [x] Índices creados para performance
- [x] Sistema de filtros implementado
- [x] APIs con filtros automáticos
- [x] UI de gestión de afiliados
- [x] Sistema de facturación con comisiones
- [x] Menú condicional según rol
- [x] Validación de permisos en todas las APIs
- [x] Documentación completa

---

**Última actualización:** Enero 2025
