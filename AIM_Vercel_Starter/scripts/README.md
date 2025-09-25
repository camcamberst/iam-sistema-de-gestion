# Scripts de Inicialización

## 1. Seed de Grupos

Ejecuta este script para crear el catálogo de grupos en la base de datos:

```bash
# Con ts-node (si tienes TypeScript instalado globalmente)
npx ts-node scripts/seed-groups.ts

# O compilando primero
npx tsc scripts/seed-groups.ts --outDir dist
node dist/scripts/seed-groups.js
```

## 2. Crear Super Administrador

**IMPORTANTE**: Este script crea el primer usuario con rol `super_admin` que tendrá acceso completo al sistema.

### Datos que necesitas:

- **Email**: Un email válido que será el usuario de login
- **Nombre**: Nombre completo del super administrador  
- **Contraseña**: Contraseña segura (mínimo 8 caracteres)

### Ejecutar:

```bash
npx ts-node scripts/create-super-admin.ts "admin@tudominio.com" "Super Administrador" "TuPasswordSegura123"
```

### Qué hace el script:

1. **Crea usuario en Supabase Auth** con el email y contraseña
2. **Crea perfil en `app_users`** con rol `super_admin`
3. **Asigna TODOS los grupos** disponibles (Cabecera, Diamante, Sede MP, Victoria, Terrazas, Satélite, Otros)
4. **Confirma el email automáticamente** (no necesitas verificar por correo)

### Después de crear el super_admin:

- Puedes hacer login con ese email/contraseña
- Tendrás acceso completo a crear/editar/eliminar usuarios
- Podrás asignar cualquier rol y cualquier grupo
- Podrás crear otros `admin` y `modelo` según las reglas del sistema

### Notas de seguridad:

- **NO** compartas las credenciales del super_admin
- **ROTA** la contraseña periódicamente
- **CREA** otros super_admin como respaldo si es necesario
- El super_admin puede **ELEVAR** roles de otros usuarios (admin → super_admin)

## Estructura de tablas requerida:

Asegúrate de tener estas tablas en Supabase:

```sql
-- Tabla de perfiles de usuario
CREATE TABLE app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'modelo')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- Catálogo de grupos
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- Relación usuarios-grupos (N:M)
CREATE TABLE user_groups (
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);
```





