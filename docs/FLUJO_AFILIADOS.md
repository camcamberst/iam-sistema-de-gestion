# 🔄 FLUJO DE TRABAJO: ESTUDIOS AFILIADOS

## 📋 RESUMEN

Este documento explica el flujo completo de creación y gestión de estudios afiliados en el sistema AIM.

---

## 🎯 FLUJO PRINCIPAL: CREAR ESTUDIO AFILIADO + SUPERADMIN AFF

### Paso 1: Superadmin Master crea el Estudio Afiliado

1. **Ubicación**: `/admin/sedes/gestionar`
2. **Acción**: Click en botón "**+ Crear Afiliado**" (visible solo para `super_admin`)
3. **Modal**: Se abre el formulario de creación

### Paso 2: Completar Datos del Estudio

El formulario incluye:

#### **Datos del Estudio:**
- **Nombre del Estudio Afiliado** * (requerido)
- **Descripción** (opcional)
- **Porcentaje de Comisión** * (requerido, por defecto: 10%)

#### **Datos del Superadmin AFF:**
- **Checkbox**: "Crear Superadmin AFF para este estudio" (marcado por defecto)
- Si está marcado, se muestran campos adicionales:
  - **Email del Superadmin AFF** * (requerido)
  - **Nombre del Superadmin AFF** * (requerido)
  - **Contraseña Temporal** * (requerido, mínimo 6 caracteres)

### Paso 3: Procesamiento Automático

Cuando se envía el formulario:

1. **Se crea el estudio afiliado** en la tabla `affiliate_studios`
2. **Si se proporcionaron datos del superadmin AFF:**
   - Se crea el usuario en `auth.users` (Supabase Auth)
   - Se crea el perfil en `users` con:
     - `role = 'superadmin_aff'`
     - `affiliate_studio_id = <id_del_estudio>` ⚠️ **ASOCIACIÓN CRÍTICA**
     - `is_active = true`

### Paso 4: Resultado

- **Éxito**: El estudio y el superadmin AFF (si se creó) quedan listos para usar
- **El superadmin AFF puede iniciar sesión** inmediatamente con su email y contraseña temporal

---

## 🔐 CÓMO EL SISTEMA ENTIENDE LOS LÍMITES DE JERARQUÍA

### 1. **Asociación por `affiliate_studio_id`**

El campo `affiliate_studio_id` en la tabla `users` es la **clave de asociación**:

```sql
-- Usuario del afiliado
users {
  id: UUID,
  email: "superadmin@estudio.com",
  role: "superadmin_aff",
  affiliate_studio_id: "uuid-del-estudio-afiliado"  ← ASOCIACIÓN
}
```

### 2. **Filtrado Automático**

El sistema usa helpers en `lib/affiliates/filters.ts` para filtrar datos:

```typescript
// Ejemplo: Obtener solo modelos del afiliado
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('affiliate_studio_id', user.affiliate_studio_id)  // ← FILTRO AUTOMÁTICO
  .eq('role', 'modelo');
```

### 3. **Permisos por Rol**

Los permisos se verifican en `lib/affiliates/permissions.ts`:

- **`superadmin_aff`**: Solo puede ver/editar datos donde `affiliate_studio_id` coincide con el suyo
- **`super_admin`** (Innova): Puede ver/editar TODO (sin filtro de afiliado)
- **`admin`** (Innova): Puede gestionar afiliados pero no ver datos de Innova

### 4. **Jerarquía de Acceso**

```
super_admin (Innova)
  ├─ Ve: TODO (Innova + Todos los Afiliados)
  └─ Control: Absoluto

superadmin_aff (Afiliado)
  ├─ Ve: Solo su burbuja (affiliate_studio_id = su estudio)
  └─ Control: Completo dentro de su burbuja

admin (Innova)
  ├─ Ve: Afiliados (para gestión) + Sus sedes asignadas
  └─ Control: Gestión de afiliados + Sus sedes

modelo (Afiliado)
  ├─ Ve: Solo sus propios datos
  └─ Control: Su perfil y calculadora
```

---

## 🏗️ ESTRUCTURA DE DATOS

### Tabla: `affiliate_studios`
```sql
{
  id: UUID,
  name: "Estudio XYZ",
  commission_percentage: 10.00,
  is_active: true,
  created_by: UUID  -- ID del super_admin que lo creó
}
```

### Tabla: `users` (con afiliado)
```sql
{
  id: UUID,
  email: "superadmin@estudio.com",
  role: "superadmin_aff",
  affiliate_studio_id: UUID,  -- ← ASOCIACIÓN AL ESTUDIO
  is_active: true
}
```

### Tabla: `groups` (sedes del afiliado)
```sql
{
  id: UUID,
  name: "Sede Principal",
  affiliate_studio_id: UUID,  -- ← ASOCIACIÓN AL ESTUDIO
  ...
}
```

---

## ✅ VERIFICACIÓN DEL FLUJO

### Después de crear un estudio afiliado:

1. **Verificar en `affiliate_studios`**:
   ```sql
   SELECT * FROM affiliate_studios WHERE name = 'Nombre del Estudio';
   ```

2. **Verificar el superadmin AFF en `users`**:
   ```sql
   SELECT * FROM users 
   WHERE role = 'superadmin_aff' 
   AND affiliate_studio_id = '<id_del_estudio>';
   ```

3. **Verificar que puede iniciar sesión**:
   - Email: El proporcionado en el formulario
   - Contraseña: La contraseña temporal

4. **Verificar límites**:
   - El superadmin AFF NO debe ver datos de otros afiliados
   - El superadmin AFF NO debe ver datos de Agencia Innova
   - El superadmin AFF SÍ debe poder crear sedes, modelos, etc. dentro de su estudio

---

## 🔄 FLUJO ALTERNATIVO: Crear Superadmin AFF Después

Si no se crea el superadmin AFF al crear el estudio:

1. **Ir a**: `/admin/users` (o donde se gestionen usuarios)
2. **Crear usuario** con:
   - Email
   - Nombre
   - Rol: `superadmin_aff`
   - **IMPORTANTE**: Asignar `affiliate_studio_id` al estudio correspondiente
3. **El sistema automáticamente aplicará los filtros** basándose en `affiliate_studio_id`

---

## 🛡️ SEGURIDAD Y VALIDACIONES

### Validaciones Automáticas:

1. **Al crear estudio**:
   - Nombre único (no puede haber dos estudios con el mismo nombre)
   - Comisión entre 0 y 100%

2. **Al crear superadmin AFF**:
   - Email único (no puede estar registrado)
   - Contraseña mínimo 6 caracteres
   - Si falla la creación del superadmin, el estudio se crea igual (no se revierte)

3. **Al filtrar datos**:
   - `superadmin_aff` solo ve datos con su `affiliate_studio_id`
   - `super_admin` ve todo (sin filtro)
   - Los filtros se aplican automáticamente en todas las APIs

---

## 📝 NOTAS IMPORTANTES

1. **El `affiliate_studio_id` es la clave**: Sin este campo, el sistema no puede asociar usuarios/sedes/modelos a un estudio afiliado.

2. **Los filtros son automáticos**: Una vez que un usuario tiene `affiliate_studio_id`, todas las consultas se filtran automáticamente.

3. **El superadmin AFF puede crear más usuarios**: Puede crear admins, modelos, etc., y automáticamente heredarán su `affiliate_studio_id` (o se puede asignar manualmente).

4. **Agencia Innova tiene control total**: El `super_admin` de Innova puede ver y editar TODO, incluyendo datos de afiliados.

---

## 🎯 PRÓXIMOS PASOS

Después de crear el estudio y superadmin AFF:

1. El superadmin AFF inicia sesión
2. Crea sus sedes (grupos) desde "Gestionar Sedes"
3. Crea sus modelos desde "Usuarios"
4. Configura sus rates desde "Rates Históricas"
5. Gestiona su portafolio y dashboard

Todo queda automáticamente dentro de su "burbuja" gracias al `affiliate_studio_id`.

