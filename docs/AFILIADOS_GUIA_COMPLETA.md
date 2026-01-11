# 🏢 GUÍA COMPLETA: SISTEMA DE ESTUDIOS AFILIADOS

## 📋 ÍNDICE

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Roles y Permisos](#roles-y-permisos)
4. [Crear un Estudio Afiliado](#crear-un-estudio-afiliado)
5. [Gestión de Usuarios](#gestión-de-usuarios)
6. [Gestión de Sedes y Grupos](#gestión-de-sedes-y-grupos)
7. [Sistema de Facturación](#sistema-de-facturación)
8. [Filtros y Seguridad](#filtros-y-seguridad)
9. [APIs Disponibles](#apis-disponibles)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 INTRODUCCIÓN

El sistema de estudios afiliados permite que estudios externos operen dentro de su propia "burbuja" de datos, completamente separados de Agencia Innova y de otros estudios afiliados. Agencia Innova mantiene control total y recibe un porcentaje de comisión de la facturación de cada afiliado.

### Características Principales

- ✅ **Multi-tenancy completo**: Cada estudio opera en su propia burbuja
- ✅ **Escalable**: Sin límites en el número de estudios afiliados
- ✅ **Seguro**: Filtros automáticos basados en `affiliate_studio_id`
- ✅ **Facturación automática**: Cálculo de comisiones integrado
- ✅ **Control total para Innova**: Super Admin puede ver y gestionar todo

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Jerarquía

```
Agencia Innova (super_admin)
  └── Estudios Afiliados (superadmin_aff)
      └── Sedes/Grupos (groups con affiliate_studio_id)
          └── Modelos (modelo con affiliate_studio_id)
```

### Principio: "Burbuja de Datos"

Cada estudio afiliado tiene su propio `affiliate_studio_id` que actúa como identificador único. Todos los datos (usuarios, sedes, modelos, facturación) se filtran automáticamente por este ID.

### Base de Datos

**Tabla principal: `affiliate_studios`**
```sql
CREATE TABLE affiliate_studios (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  commission_percentage DECIMAL(5,2) DEFAULT 10.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);
```

**Columnas agregadas a tablas existentes:**
- `users.affiliate_studio_id` - Asocia usuarios al estudio
- `groups.affiliate_studio_id` - Asocia sedes/grupos al estudio
- `announcements.affiliate_studio_id` - Anuncios del estudio
- `announcements.share_with_affiliates` - Compartir anuncios de Innova

---

## 👥 ROLES Y PERMISOS

### Super Admin (Agencia Innova)

**Rol:** `super_admin`

**Puede:**
- ✅ Ver y gestionar TODOS los estudios afiliados
- ✅ Crear, editar y eliminar estudios afiliados
- ✅ Ver toda la facturación (Innova + Afiliados)
- ✅ Configurar porcentaje de comisión por estudio
- ✅ Gestionar usuarios de cualquier afiliado
- ✅ Ver datos de todos los afiliados

**Acceso:**
- Panel completo sin restricciones
- `/admin/affiliates/gestionar` - Gestión de afiliados

### Superadmin AFF (Estudio Afiliado)

**Rol:** `superadmin_aff`

**Puede:**
- ✅ Crear usuarios (admin, modelo) para su estudio
- ✅ Gestionar sedes/grupos de su estudio
- ✅ Configurar calculadora para modelos de su estudio
- ✅ Ver calculadora de modelos de su estudio
- ✅ Gestionar anticipos de su estudio
- ✅ Ver dashboard y facturación de su estudio
- ✅ Crear y gestionar rooms de su estudio
- ✅ Ver portafolio de su estudio
- ✅ Gestionar anuncios de su estudio

**NO puede:**
- ❌ Ver datos de Agencia Innova
- ❌ Ver datos de otros estudios afiliados
- ❌ Crear/editar plataformas del sistema
- ❌ Definir RATES (son definidas por Agencia Innova)
- ❌ Acceder a configuraciones globales

**Acceso:**
- Panel limitado a su estudio
- Solo ve opciones relevantes para su rol

### Admin (dentro de afiliado)

**Rol:** `admin` con `affiliate_studio_id` asignado

**Puede:**
- ✅ Mismas funciones que `superadmin_aff` dentro de su burbuja
- ✅ Gestionar usuarios, sedes, calculadora de su afiliado

**NO puede:**
- ❌ Ver datos fuera de su afiliado

### Modelo (dentro de afiliado)

**Rol:** `modelo` con `affiliate_studio_id` asignado

**Puede:**
- ✅ Ver su propia calculadora
- ✅ Ver su propio portafolio
- ✅ Gestionar su perfil

**NO puede:**
- ❌ Ver datos de otros modelos o sedes

---

## ➕ CREAR UN ESTUDIO AFILIADO

### Paso 1: Acceder a Gestión de Afiliados

1. Iniciar sesión como `super_admin`
2. Ir a `/admin/affiliates/gestionar`
3. Click en "**+ Crear Afiliado**"

### Paso 2: Completar Formulario

**Datos del Estudio:**
- **Nombre del Estudio** * (requerido, único)
- **Descripción** (opcional)
- **Porcentaje de Comisión** * (requerido, default: 10%)

**Datos del Superadmin AFF (opcional):**
- Checkbox: "Crear Superadmin AFF para este estudio"
- Si está marcado:
  - **Email del Superadmin AFF** * (requerido, único)
  - **Nombre del Superadmin AFF** * (requerido)
  - **Contraseña Temporal** * (requerido, mínimo 6 caracteres)

### Paso 3: Procesamiento

El sistema automáticamente:
1. Crea el estudio en `affiliate_studios`
2. Si se proporcionaron datos del superadmin:
   - Crea usuario en `auth.users` (Supabase Auth)
   - Crea perfil en `users` con:
     - `role = 'superadmin_aff'`
     - `affiliate_studio_id = <id_del_estudio>`
     - `is_active = true`

### Paso 4: Verificación

Después de crear:
1. El estudio aparece en la lista de afiliados
2. El superadmin AFF puede iniciar sesión inmediatamente
3. El superadmin AFF solo ve datos de su estudio

---

## 👤 GESTIÓN DE USUARIOS

### Crear Usuario desde Superadmin AFF

1. Ir a `/admin/users/create`
2. Completar formulario:
   - **Email** *
   - **Nombre** *
   - **Rol**: Solo `admin` o `modelo` (opciones limitadas)
   - **Grupo**: Solo grupos del estudio afiliado
3. El sistema automáticamente asigna `affiliate_studio_id` del superadmin AFF

### Crear Usuario desde Super Admin

1. Ir a `/admin/users/create`
2. Completar formulario:
   - **Email** *
   - **Nombre** *
   - **Rol**: Cualquier rol disponible
   - **Grupo**: Todos los grupos (Innova + Afiliados)
   - **Estudio Afiliado**: Seleccionar si es para un afiliado
3. Si se selecciona un estudio afiliado, se asigna `affiliate_studio_id`

### Verificación de Usuarios

Los usuarios del afiliado:
- Aparecen solo en listados del superadmin AFF
- No aparecen en listados de Agencia Innova (a menos que sea super admin)
- Tienen `affiliate_studio_id` asignado

---

## 🏢 GESTIÓN DE SEDES Y GRUPOS

### Crear Sede desde Superadmin AFF

1. Ir a `/admin/sedes/gestionar`
2. Click en "**Crear Nueva Sede**"
3. Completar formulario:
   - **Nombre de la Sede** *
   - **Administrador Asignado**: Solo admins del estudio
4. El sistema automáticamente asigna `affiliate_studio_id`

### Verificación de Sedes

Las sedes del afiliado:
- Aparecen solo en el dropdown del superadmin AFF
- No aparecen en listados de Agencia Innova
- Tienen `affiliate_studio_id` asignado

### Crear Rooms

1. Seleccionar la sede en el dropdown
2. Ir a la sección de "Rooms"
3. Crear rooms normalmente
4. Los rooms quedan asociados a la sede (y por ende al afiliado)

---

## 💰 SISTEMA DE FACTURACIÓN

### Distribución de Facturación para Afiliados

**Para modelos de estudios afiliados:**
- **Modelo**: 60% del bruto
- **Estudio Afiliado**: 30% del bruto (neto)
- **Agencia Innova**: 10% del bruto (comisión)

**Nota:** El 10% de comisión para Innova es asumido por el afiliado.

### Visualización en Dashboard

**Desde Super Admin (Agencia Innova):**
- Ve "Agencia Innova" con todas sus sedes
- Ve cada estudio afiliado como sección separada: `[Nombre] - Afiliado`
- Ve comisión total de todos los afiliados

**Desde Superadmin AFF:**
- Ve solo su estudio
- Ve "USD Bruto Total", "USD Afiliado" (90%), "USD Comisión Innova" (10%)
- Ve desglose por sedes y modelos

### Cálculo Automático

El sistema calcula automáticamente:
1. Facturación bruta de cada modelo
2. 60% para el modelo
3. 30% para el estudio afiliado
4. 10% para Agencia Innova

Todo se calcula en tiempo real desde `calculator_totals` o `calculator_history`.

---

## 🔒 FILTROS Y SEGURIDAD

### Filtros Automáticos

El sistema usa `lib/affiliates/filters.ts` para aplicar filtros automáticamente:

```typescript
// Ejemplo: Obtener solo modelos del afiliado
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('affiliate_studio_id', user.affiliate_studio_id)
  .eq('role', 'modelo');
```

### Helpers Disponibles

**`addAffiliateFilter(query, user)`**
- Agrega filtro de `affiliate_studio_id` según el rol del usuario
- `super_admin`: Sin filtro (ve todo)
- `superadmin_aff`: Solo su `affiliate_studio_id`

**`canAccessAffiliateResource(user, resourceAffiliateStudioId)`**
- Verifica si un usuario puede acceder a un recurso específico

**`getAllowedAffiliateStudioIds(user)`**
- Retorna lista de `affiliate_studio_id` permitidos
- `null` = sin restricción (super_admin)

### Seguridad

- ✅ Filtros aplicados en todas las APIs
- ✅ Validación de permisos en cada endpoint
- ✅ `affiliate_studio_id` verificado en cada operación
- ✅ No hay acceso cruzado entre afiliados

---

## 🔌 APIS DISPONIBLES

### Gestión de Estudios Afiliados

**GET `/api/admin/affiliates`**
- Lista todos los estudios afiliados
- Requiere: `super_admin` o `admin` de Innova
- Retorna: Lista con estadísticas

**POST `/api/admin/affiliates`**
- Crea un nuevo estudio afiliado
- Requiere: `super_admin` o `admin` de Innova
- Body: `{ name, description, commission_percentage, superadmin_email?, superadmin_name?, superadmin_password? }`

**GET `/api/admin/affiliates/[id]`**
- Obtiene un estudio afiliado por ID
- Requiere: `super_admin` o `admin` de Innova
- Retorna: Datos del estudio + estadísticas

**PUT `/api/admin/affiliates/[id]`**
- Actualiza un estudio afiliado
- Requiere: `super_admin` o `admin` de Innova
- Body: `{ name?, description?, commission_percentage?, is_active? }`

**POST `/api/admin/affiliates/[id]/superadmin`**
- Crea superadmin AFF para un estudio existente
- Requiere: `super_admin` o `admin` de Innova
- Body: `{ email, name, password }`

### Facturación

**GET `/api/admin/billing-summary`**
- Obtiene resumen de facturación
- Requiere: `super_admin`, `admin`, o `superadmin_aff`
- Parámetros: `adminId`, `userRole`, `periodDate`
- Retorna: Facturación filtrada según rol

### Otros Endpoints

Todos los endpoints existentes aplican filtros automáticos:
- `/api/groups` - Solo grupos del afiliado
- `/api/users` - Solo usuarios del afiliado
- `/api/announcements` - Solo anuncios del afiliado o compartidos
- `/api/anticipos` - Solo anticipos del afiliado
- `/api/calculator/*` - Solo calculadoras del afiliado

---

## 🔧 TROUBLESHOOTING

### Problema: Usuario no ve datos de su afiliado

**Solución:**
1. Verificar que el usuario tiene `affiliate_studio_id` asignado
2. Verificar que el `affiliate_studio_id` coincide con el estudio correcto
3. Verificar que el rol es `superadmin_aff` o `admin` con `affiliate_studio_id`

### Problema: Sede aparece en Agencia Innova cuando es de afiliado

**Solución:**
1. Verificar que la sede tiene `affiliate_studio_id` asignado
2. Verificar que el modelo tiene `affiliate_studio_id` asignado
3. El sistema filtra automáticamente, pero si falta el ID, puede aparecer en ambos

### Problema: Facturación incorrecta

**Solución:**
1. Verificar que los modelos tienen `affiliate_studio_id` asignado
2. Verificar que el cálculo usa la lógica correcta (60% modelo, 30% estudio, 10% Innova)
3. Verificar que `calculator_totals` tiene datos para los modelos

### Problema: No se puede crear superadmin AFF

**Solución:**
1. Verificar que el email no está ya registrado
2. Verificar que la contraseña tiene mínimo 6 caracteres
3. Verificar permisos del usuario que intenta crear (debe ser `super_admin`)

---

## 📝 NOTAS IMPORTANTES

1. **`affiliate_studio_id` es la clave**: Sin este campo, el sistema no puede asociar datos al estudio
2. **Filtros automáticos**: Una vez asignado `affiliate_studio_id`, los filtros se aplican automáticamente
3. **Escalable**: El sistema puede manejar cualquier cantidad de estudios afiliados
4. **Separación completa**: Cada estudio opera en su propia burbuja, sin acceso cruzado
5. **Control de Innova**: Super Admin siempre puede ver y gestionar todo

---

## 📚 DOCUMENTACIÓN ADICIONAL

- [Arquitectura Técnica](./AFILIADOS_ARQUITECTURA.md)
- [Referencia de APIs](./AFILIADOS_API_REFERENCE.md)
- [Sistema de Facturación](./AFILIADOS_FACTURACION.md)
- [Flujo de Trabajo](./FLUJO_AFILIADOS.md)

---

**Última actualización:** Enero 2025
