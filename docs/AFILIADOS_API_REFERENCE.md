# 🔌 REFERENCIA DE APIs: ESTUDIOS AFILIADOS

## 📋 ÍNDICE

1. [Gestión de Estudios Afiliados](#gestión-de-estudios-afiliados)
2. [Facturación](#facturación)
3. [Filtros Automáticos](#filtros-automáticos)
4. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🏢 GESTIÓN DE ESTUDIOS AFILIADOS

### GET `/api/admin/affiliates`

Lista todos los estudios afiliados con estadísticas.

**Autenticación:** Requerida (Bearer token)

**Permisos:** `super_admin` o `admin` de Innova

**Query Parameters:** Ninguno

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Estudio XYZ",
      "description": "Descripción del estudio",
      "commission_percentage": 10.00,
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z",
      "created_by": "uuid",
      "created_by_user": {
        "id": "uuid",
        "name": "Super Admin",
        "email": "admin@innova.com"
      },
      "superadmin_aff": {
        "id": "uuid",
        "name": "Admin AFF",
        "email": "admin@estudio.com",
        "is_active": true
      },
      "stats": {
        "users": 5,
        "sedes": 2,
        "models": 3
      }
    }
  ]
}
```

**Response 401:**
```json
{
  "success": false,
  "error": "No autorizado"
}
```

---

### POST `/api/admin/affiliates`

Crea un nuevo estudio afiliado.

**Autenticación:** Requerida (Bearer token)

**Permisos:** `super_admin` o `admin` de Innova

**Body:**
```json
{
  "name": "Estudio XYZ",
  "description": "Descripción opcional",
  "commission_percentage": 10.00,
  "superadmin_email": "admin@estudio.com",
  "superadmin_name": "Admin AFF",
  "superadmin_password": "password123"
}
```

**Campos:**
- `name` * (requerido): Nombre único del estudio
- `description` (opcional): Descripción del estudio
- `commission_percentage` (opcional, default: 10.00): Porcentaje de comisión (0-100)
- `superadmin_email` (opcional): Email del superadmin AFF
- `superadmin_name` (opcional): Nombre del superadmin AFF
- `superadmin_password` (opcional): Contraseña temporal (mínimo 6 caracteres)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Estudio XYZ",
    "description": "Descripción opcional",
    "commission_percentage": 10.00,
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "created_by": "uuid",
    "superadmin_aff": {
      "id": "uuid",
      "email": "admin@estudio.com",
      "name": "Admin AFF"
    }
  },
  "message": "Estudio afiliado y superadmin AFF creados exitosamente"
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "El nombre del estudio es requerido"
}
```

---

### GET `/api/admin/affiliates/[id]`

Obtiene un estudio afiliado por ID.

**Autenticación:** Requerida (Bearer token)

**Permisos:** `super_admin` o `admin` de Innova

**Path Parameters:**
- `id`: UUID del estudio afiliado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Estudio XYZ",
    "description": "Descripción",
    "commission_percentage": 10.00,
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z",
    "created_by": "uuid",
    "created_by_user": {
      "id": "uuid",
      "name": "Super Admin",
      "email": "admin@innova.com"
    },
    "superadmin_aff": {
      "id": "uuid",
      "name": "Admin AFF",
      "email": "admin@estudio.com",
      "is_active": true
    },
    "stats": {
      "users": 5,
      "sedes": 2,
      "models": 3
    }
  }
}
```

**Response 404:**
```json
{
  "success": false,
  "error": "Estudio afiliado no encontrado"
}
```

---

### PUT `/api/admin/affiliates/[id]`

Actualiza un estudio afiliado.

**Autenticación:** Requerida (Bearer token)

**Permisos:** `super_admin` o `admin` de Innova

**Path Parameters:**
- `id`: UUID del estudio afiliado

**Body:**
```json
{
  "name": "Nuevo Nombre",
  "description": "Nueva descripción",
  "commission_percentage": 12.00,
  "is_active": true
}
```

**Campos (todos opcionales):**
- `name`: Nuevo nombre (debe ser único)
- `description`: Nueva descripción
- `commission_percentage`: Nuevo porcentaje (0-100)
- `is_active`: Estado activo/inactivo

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Nuevo Nombre",
    "description": "Nueva descripción",
    "commission_percentage": 12.00,
    "is_active": true,
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### POST `/api/admin/affiliates/[id]/superadmin`

Crea un superadmin AFF para un estudio existente.

**Autenticación:** Requerida (Bearer token)

**Permisos:** `super_admin` o `admin` de Innova

**Path Parameters:**
- `id`: UUID del estudio afiliado

**Body:**
```json
{
  "email": "admin@estudio.com",
  "name": "Admin AFF",
  "password": "password123"
}
```

**Campos:**
- `email` * (requerido): Email único
- `name` * (requerido): Nombre del superadmin
- `password` * (requerido): Contraseña temporal (mínimo 6 caracteres)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@estudio.com",
    "name": "Admin AFF"
  },
  "message": "Superadmin AFF creado exitosamente"
}
```

---

## 💰 FACTURACIÓN

### GET `/api/admin/billing-summary`

Obtiene resumen de facturación filtrado según el rol del usuario.

**Autenticación:** Requerida (Bearer token)

**Permisos:** `super_admin`, `admin`, o `superadmin_aff`

**Query Parameters:**
- `adminId` * (requerido): ID del usuario que solicita
- `userRole` * (requerido): Rol del usuario (`super_admin`, `admin`, `superadmin_aff`)
- `periodDate` (opcional): Fecha del período (formato: YYYY-MM-DD)
- `sedeId` (opcional): ID de la sede específica

**Response 200 (Super Admin):**
```json
{
  "success": true,
  "data": [...], // Lista de modelos
  "summary": {
    "totalModels": 50,
    "totalUsdBruto": 10000.00,
    "totalUsdModelo": 7000.00,
    "totalUsdSede": 3000.00,
    "agenciaInnova": {
      "totalUsdBruto": 8000.00,
      "totalUsdModelo": 5600.00,
      "totalUsdSede": 2400.00
    }
  },
  "groupedData": [
    {
      "sedeId": "agencia-innova",
      "sedeName": "Agencia Innova",
      "groups": [...],
      "totalModels": 40,
      "totalUsdBruto": 8000.00,
      "totalUsdModelo": 5600.00,
      "totalUsdSede": 2400.00
    },
    {
      "sedeId": "affiliate-uuid",
      "sedeName": "Estudio XYZ - Afiliado",
      "isAffiliate": true,
      "affiliate_studio_id": "uuid",
      "groups": [...],
      "totalModels": 10,
      "totalUsdBruto": 2000.00,
      "totalUsdModelo": 1200.00,
      "totalUsdSede": 600.00,
      "totalUsdAfiliado": 1800.00,
      "totalCopAfiliado": 7020000.00
    }
  ]
}
```

**Response 200 (Superadmin AFF):**
```json
{
  "success": true,
  "data": [...], // Solo modelos del afiliado
  "summary": {
    "totalModels": 10,
    "totalUsdBruto": 2000.00,
    "totalUsdModelo": 1200.00,
    "totalUsdSede": 600.00
  },
  "groupedData": [
    {
      "sedeId": "affiliate-uuid",
      "sedeName": "Estudio XYZ",
      "groups": [...],
      "totalModels": 10,
      "totalUsdBruto": 2000.00,
      "totalUsdModelo": 1200.00,
      "totalUsdSede": 600.00
    }
  ],
  "affiliateStudioName": "Estudio XYZ"
}
```

---

## 🔒 FILTROS AUTOMÁTICOS

### Endpoints con Filtros Automáticos

Todos estos endpoints aplican filtros automáticos según el rol:

**GET `/api/groups`**
- `super_admin`: Todos los grupos
- `superadmin_aff`: Solo grupos con su `affiliate_studio_id`

**GET `/api/users`**
- `super_admin`: Todos los usuarios
- `superadmin_aff`: Solo usuarios con su `affiliate_studio_id`

**GET `/api/announcements`**
- `super_admin`: Todos los anuncios
- `superadmin_aff`: Solo anuncios con su `affiliate_studio_id` o `share_with_affiliates = true`

**GET `/api/anticipos`**
- `super_admin`: Todos los anticipos
- `superadmin_aff`: Solo anticipos de modelos con su `affiliate_studio_id`

**GET `/api/calculator/models`**
- `super_admin`: Todos los modelos
- `superadmin_aff`: Solo modelos con su `affiliate_studio_id`

**GET `/api/calculator/config-v2`**
- `super_admin`: Todas las configuraciones
- `superadmin_aff`: Solo configuraciones de modelos con su `affiliate_studio_id`

---

## 💻 EJEMPLOS DE USO

### Crear Estudio Afiliado con Superadmin

```typescript
const response = await fetch('/api/admin/affiliates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Estudio XYZ',
    description: 'Estudio de modelos',
    commission_percentage: 10.00,
    superadmin_email: 'admin@estudio.com',
    superadmin_name: 'Admin AFF',
    superadmin_password: 'password123'
  })
});

const data = await response.json();
```

### Listar Estudios Afiliados

```typescript
const response = await fetch('/api/admin/affiliates', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data } = await response.json();
console.log('Estudios:', data);
```

### Obtener Facturación de Afiliado

```typescript
const params = new URLSearchParams({
  adminId: userId,
  userRole: 'superadmin_aff',
  periodDate: '2025-01-15'
});

const response = await fetch(`/api/admin/billing-summary?${params}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data, summary, groupedData } = await response.json();
```

### Usar Filtros en Consultas

```typescript
import { addAffiliateFilter } from '@/lib/affiliates/filters';

const user = {
  id: 'uuid',
  role: 'superadmin_aff',
  affiliate_studio_id: 'uuid-estudio'
};

let query = supabase.from('users').select('*');
query = addAffiliateFilter(query, user);

const { data } = await query;
// Solo usuarios del afiliado
```

---

## ⚠️ ERRORES COMUNES

### Error 401: No autorizado

**Causa:** Token inválido o rol sin permisos

**Solución:** Verificar token y rol del usuario

### Error 400: Nombre duplicado

**Causa:** Ya existe un estudio con ese nombre

**Solución:** Usar un nombre único

### Error 400: Email duplicado

**Causa:** El email del superadmin ya está registrado

**Solución:** Usar un email diferente

### Error 404: Estudio no encontrado

**Causa:** El ID del estudio no existe

**Solución:** Verificar el ID del estudio

---

**Última actualización:** Enero 2025
