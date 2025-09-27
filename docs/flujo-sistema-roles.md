# 🔄 DIAGRAMA DE FLUJO DEL SISTEMA IAM - POR ROLES

## 🏠 ARQUITECTURA GENERAL DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA IAM MODERNIZADO                     │
│                    (Smart Home Architecture)                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 FLUJO DE AUTENTICACIÓN INICIAL

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   USUARIO       │───▶│   LOGIN PAGE    │───▶│   SUPABASE AUTH │
│   (Cualquier    │    │   /login        │    │   Verificación  │
│    Rol)         │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   VALIDACIÓN    │
                       │   - Email       │
                       │   - Password    │
                       │   - Formato     │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   OBTENER DATOS │
                       │   - auth.users  │
                       │   - public.users│
                       │   - user_groups │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   REDIRECCIÓN   │
                       │   POR ROL       │
                       └─────────────────┘
```

## 🎭 FLUJOS POR ROL

### 👑 SUPER ADMIN (super_admin)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SUPER ADMIN   │───▶│   DASHBOARD     │───▶│   ACCESO TOTAL  │
│   LOGIN         │    │   ADMINISTRATIVO │    │   - Todos los    │
│                 │    │   /admin/dashboard│   │     permisos    │
└─────────────────┘    └─────────────────┘    │   - Todas las    │
                                │              │     funciones    │
                                ▼              │   - Auditoría    │
                       ┌─────────────────┐    │     completa    │
                       │   NAVEGACIÓN    │    └─────────────────┘
                       │   - Gestión     │
                       │     Usuarios    │
                       │   - Gestión     │
                       │     Grupos      │
                       │   - Auditoría   │
                       │   - Reportes    │
                       │   - Sistema     │
                       └─────────────────┘
```

### 👨‍💼 ADMIN (admin)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ADMIN         │───▶│   DASHBOARD     │───▶│   ACCESO        │
│   LOGIN         │    │   ADMINISTRATIVO │    │   - Gestión     │
│                 │    │   /admin/dashboard│   │     usuarios    │
└─────────────────┘    └─────────────────┘    │   - Gestión     │
                                │              │     grupos      │
                                ▼              │   - Reportes    │
                       ┌─────────────────┐    │   - Auditoría   │
                       │   NAVEGACIÓN    │    │     limitada    │
                       │   - Gestión     │    └─────────────────┘
                       │     Usuarios    │
                       │   - Gestión     │
                       │     Grupos      │
                       │   - Reportes    │
                       │   - Auditoría   │
                       └─────────────────┘
```

### 👩‍💼 MODELO (modelo)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MODELO        │───▶│   DASHBOARD     │───▶│   ACCESO        │
│   LOGIN         │    │   PERSONAL      │    │   - Perfil      │
│                 │    │   /modelo/dashboard│ │     personal    │
└─────────────────┘    └─────────────────┘    │   - Sesiones    │
                                │              │   - Grupos      │
                                ▼              │     asignados   │
                       ┌─────────────────┐    │   - Actividades │
                       │   FUNCIONES     │    │     limitadas   │
                       │   - Ver perfil  │    └─────────────────┘
                       │   - Editar datos│
                       │   - Ver sesiones│
                       │   - Ver grupos  │
                       └─────────────────┘
```


## 🔄 FLUJO DETALLADO DE GESTIÓN DE USUARIOS (SUPER ADMIN/ADMIN)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GESTIÓN       │───▶│   LISTA         │───▶│   ACCIONES      │
│   USUARIOS      │    │   USUARIOS      │    │   - Crear       │
│   /admin/users │    │   - Tabla       │    │   - Editar      │
│                 │    │   - Filtros     │    │   - Eliminar    │
│                 │    │   - Búsqueda    │    │   - Activar/    │
│                 │    │                 │    │     Desactivar  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   MODALES       │
                       │   - Crear       │
                       │   - Editar      │
                       │   - Confirmar   │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   VALIDACIÓN    │
                       │   - Tiempo real │
                       │   - Errores     │
                       │   - Advertencias│
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   API CALLS     │
                       │   - POST /api/  │
                       │     users       │
                       │   - PATCH /api/ │
                       │     users/[id]  │
                       │   - DELETE /api/│
                       │     users/[id]  │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   AUDITORÍA     │
                       │   - Log acción  │
                       │   - IP address  │
                       │   - Timestamp   │
                       │   - Resultado   │
                       └─────────────────┘
```

## 🔍 FLUJO DE AUDITORÍA (SUPER ADMIN/ADMIN)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AUDITORÍA     │───▶│   LOGS          │───▶│   FILTROS       │
│   /admin/audit  │    │   - Tabla       │    │   - Severidad   │
│                 │    │   - Timestamp   │    │   - Acción      │
│                 │    │   - Usuario     │    │   - Estado      │
│                 │    │   - IP          │    │   - Fecha       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   ESTADÍSTICAS  │
                       │   - Total logs  │
                       │   - Tasa éxito  │
                       │   - Eventos     │
                       │     críticos    │
                       │   - Anomalías   │
                       └─────────────────┘
```

## 🛡️ FLUJO DE SEGURIDAD Y PERMISOS

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PETICIÓN      │───▶│   MIDDLEWARE    │───▶│   VERIFICACIÓN  │
│   API           │    │   SEGURIDAD     │    │   - Autenticación│
│                 │    │                 │    │   - Permisos    │
│                 │    │                 │    │   - Organización│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   DECISIÓN      │
                       │   - Permitir    │
                       │   - Denegar     │
                       │   - Log acción  │
                       └─────────────────┘
```

## 📊 FLUJO DE DATOS Y PERSISTENCIA

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │───▶│   API ROUTES    │───▶│   SUPABASE      │
│   React/Next.js │    │   /api/*        │    │   - auth.users  │
│                 │    │                 │    │   - public.users│
│                 │    │                 │    │   - user_groups │
│                 │    │                 │    │   - audit_logs  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   VALIDACIÓN    │
                       │   - Datos       │
                       │   - Permisos    │
                       │   - Seguridad   │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   RESPUESTA     │
                       │   - JSON        │
                       │   - Error codes │
                       │   - Headers     │
                       └─────────────────┘
```

## 🎯 PUNTOS DE DECISIÓN CLAVE

### 1. **AUTENTICACIÓN INICIAL**
- ✅ Usuario existe en `auth.users`
- ✅ Perfil existe en `public.users`
- ✅ Usuario activo
- ✅ Organización válida

### 2. **AUTORIZACIÓN POR ROL**
- ✅ Super Admin: Acceso total
- ✅ Admin: Gestión limitada
- ✅ Modelo: Solo perfil personal

### 3. **VALIDACIÓN DE DATOS**
- ✅ Email válido
- ✅ Contraseña segura
- ✅ Nombre válido
- ✅ Rol permitido

### 4. **AUDITORÍA Y SEGURIDAD**
- ✅ Log de todas las acciones
- ✅ Headers de seguridad
- ✅ Protección contra ataques
- ✅ Rate limiting

## 🚀 ESTADO ACTUAL DEL SISTEMA

✅ **DEPLOYMENT EXITOSO EN VERCEL**  
✅ **TODAS LAS FUNCIONALIDADES IMPLEMENTADAS**  
✅ **SISTEMA COMPLETAMENTE FUNCIONAL**  

### 🔗 **ENLACES DE ACCESO:**
- **Login:** `/login`
- **Dashboard Admin:** `/admin/dashboard`
- **Gestión Usuarios:** `/admin/users`
- **Auditoría:** `/admin/audit`

### 🎭 **CREDENCIALES DE PRUEBA:**
- **Super Admin:** `superadmin@example.com` / `123456`
- **Admin:** `admin@example.com` / `admin123`
- **Modelo:** `modelo@example.com` / `modelo123`
