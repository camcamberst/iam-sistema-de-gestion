# Información para integración Desktop|AIM con AIM Sistema de Gestión

Documento preparado para diseñar el Desktop|AIM y asegurar su integración con el sistema existente.

---

## 1. Esquema de Base de Datos (Supabase)

El sistema usa **Supabase** (PostgreSQL). Las tablas principales están en el esquema `public`; la autenticación usa `auth.users`.

### 1.1 Usuarios y roles

- **`public.users`**  
  - `id` UUID PK, REFERENCES `auth.users(id)` ON DELETE CASCADE  
  - `organization_id` UUID → `organizations(id)`  
  - `name` TEXT NOT NULL  
  - `role` TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'modelo'))  
  - `is_active` BOOLEAN DEFAULT true  
  - `last_login` TIMESTAMPTZ  
  - `metadata` JSONB  
  - `created_at`, `updated_at`  

- **`organizations`**  
  - `id`, `name`, `description`, `settings` (JSONB), `created_at`, `updated_at`  

- **`groups`**  
  - `id`, `organization_id`, `name`, `description`, `is_active`, `created_at`  
  - UNIQUE(organization_id, name)  

- **`user_groups`**  
  - `id`, `user_id` → users(id), `group_id` → groups(id), `is_manager` BOOLEAN, `joined_at`  
  - UNIQUE(user_id, group_id)  

- **`audit_logs`**  
  - `id`, `user_id`, `action`, `resource_type`, `resource_id`, `details` (JSONB), `ip_address`, `user_agent`, `created_at`  

Los roles definidos son: **super_admin**, **admin**, **modelo**.

### 1.2 Plataformas asignadas a cada modelo

- **`modelo_plataformas`**  
  - `id` UUID PK  
  - `model_id` UUID → auth.users(id)  
  - `platform_name` VARCHAR(100) NOT NULL  
  - `status` VARCHAR(20) CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'desactivada', 'inviable'))  
  - `requested_at`, `delivered_at`, `confirmed_at`, `deactivated_at`, `reverted_at`  
  - `requested_by`, `delivered_by`, `confirmed_by`, `deactivated_by`, `reverted_by` (UUID → auth.users)  
  - `notes`, `revert_reason`, `is_initial_config`, `calculator_sync`, `calculator_activated_at`  
  - `created_at`, `updated_at`  
  - UNIQUE(model_id, platform_name)  

- **`plataformas_catalogo`**  
  - `id`, `name` UNIQUE, `code` UNIQUE, `description`, `is_active`, `created_at`, `updated_at`  

- **`modelo_plataformas_history`**  
  - Historial de cambios de estado de `modelo_plataformas`.  

- **Vista:** `modelo_plataformas_detailed` (join con users, grupos, catálogo, etc.)  

**Credenciales en `modelo_plataformas` (migraciones aplicadas):**  
- `login_url`, `login_username`, `login_password_encrypted`  
- `credentials_updated_at`, `credentials_updated_by`  
- Para 3CX: `app_3cx_username`, `app_3cx_password_encrypted`, `app_3cx_credentials_updated_at`, `app_3cx_credentials_updated_by`  

Los SQL de referencia están en el repo en:  
- `db/modelo_plataformas_schema.sql`  
- `db/modelo_plataformas/add_credentials_columns.sql`  
- `db/modelo_plataformas/add_3cx_credentials_columns.sql`  

### 1.3 Otras tablas relevantes

- **Calculadora / historial:**  
  - `calculator_config`, `calculator_platforms`, `calculator_history`, `model_values`, `rates`, `periods`, `calculator_deductions`, `calculator_period_closure_status`, etc.  
  - Ver `db/calculadora/schema_calculadora.sql` y archivos en `db/calculadora/`.  

- **Ahorros:**  
  - `model_savings`, `savings_withdrawals`, `savings_adjustments`, `savings_goals`  
  - Ver `db/savings/create_savings_schema.sql`.  

- **Anticipos:**  
  - `periods`, `anticipos` (relacionados con períodos y modelos).  

- **Chat / anuncios:**  
  - `announcements`, `announcement_group_targets`, tablas de chat (conversations, messages, etc.).  

- **Tienda / afiliados:**  
  - Tablas en `db/shop/`, `db/affiliates/` según módulos activos.  

Para un esquema completo se puede:  
- Exportar desde Supabase (Table Editor → estructura de tablas)  
- O revisar todos los `.sql` bajo `db/` en el repositorio.

---

## 2. Sistema de Autenticación

- **Proveedor:** **Supabase Auth** (email/password; posible extensión OAuth según configuración).  
- **Roles:** almacenados en `public.users.role`:  
  - **super_admin** – acceso total al sistema.  
  - **admin** – gestión de usuarios y grupos de su organización; acceso limitado por `user_groups` (solo modelos de sus grupos).  
  - **modelo** – acceso a su propio perfil, calculadora, ahorros, retiros, portafolio, etc.  

- **Permisos:**  
  - En base de datos: **RLS (Row Level Security)** en las tablas (p. ej. `modelo_plataformas`: super_admin todo; admin según grupos; modelo solo sus filas).  
  - En aplicación: las rutas API reciben el token (Bearer), llaman a `supabase.auth.getUser(token)` y comprueban `users.role` y, si aplica, pertenencia a grupos antes de devolver o modificar datos.  

- **Cliente en el front:** se usa un cliente Supabase creado con **anon key** (NEXT_PUBLIC_SUPABASE_ANON_KEY) y persistencia de sesión; las APIs que requieren privilegios usan el **service role** en servidor.

---

## 3. API existente

El acceso a datos **no** es solo client-side: hay una capa **API** en Next.js (`app/api/...`). Listado de rutas (solo `app/api`, excluyendo `.next`):

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session` (o equivalente)

### Usuarios y grupos
- `GET/POST /api/users`
- `GET/POST /api/users/transfer`
- `GET /api/groups`
- `GET /api/groups/rooms`
- `GET /api/groups/[groupId]/models`
- `GET/POST /api/assignments/[userId]`
- `GET /api/assignments/all`
- `GET/POST /api/room-assignments`
- `GET /api/test-groups`

### Modelo – calculadora
- `GET /api/model/calculator/historial`
- `GET/POST /api/model/calculator/historial/deductions`
- `GET/POST /api/model/calculator/historial/update`

### Modelo – ahorros
- `GET /api/model/savings/dashboard`
- `GET/POST /api/model/savings`
- `GET/POST /api/model/savings/goals`
- `GET/PUT/DELETE /api/model/savings/goals/[id]`
- `GET/POST /api/model/savings/withdrawals`
- `GET/PUT /api/model/savings/[id]`

### Modelo – portafolio / plataformas
- `GET /api/modelo-plataformas`
- `GET /api/modelo-plataformas/[modelId]`
- `GET/POST /api/modelo-plataformas/credentials`
- `GET/POST /api/modelo-plataformas/credentials-3cx`
- `GET /api/modelo-plataformas/timeline`
- `POST /api/modelo-plataformas/timeline/[requestId]/close`
- `GET /api/modelo-portafolio`
- `GET /api/modelo-portafolio/analytics`
- `POST /api/modelo-portafolio/confirm`
- `GET /api/plataformas-catalogo`
- `GET /api/models/google-drive-config`
- `GET /api/models/[modelId]/assignments`

### Calculadora (admin / lógica interna)
- `GET /api/calculator/config-v2`
- `GET /api/calculator/admin-view`
- `GET /api/calculator/admin-totals`
- `GET /api/calculator/models`
- `GET /api/calculator/mi-calculadora-real`
- `GET /api/calculator/preview`
- `GET /api/calculator/platforms`
- `GET /api/calculator/rates-active`
- `GET /api/calculator/totals`
- `GET /api/calculator/unified-productivity`
- `GET /api/calculator/model-values-v2`
- `GET /api/calculator/period-goal-summary`
- Varios bajo `calculator/period-closure/` (check-status, manual-close, archive-period, etc.)
- `GET /api/calculator/search-history`, `search-snapshots`, `recalculate-totals`, `sync-missing-totals`, `force-reset`, etc.
- `GET /api/rates`, `GET/PUT /api/rates/[id]`, `GET /api/rates/reference`, `POST /api/rates/automation`
- `GET /api/rates-v2`

### Admin – ahorros
- `GET /api/admin/savings`
- `GET/POST /api/admin/savings/adjustments`
- `GET /api/admin/savings/stats`
- `GET /api/admin/savings/withdrawals`
- `POST /api/admin/savings/withdrawals/[id]/approve`
- `POST /api/admin/savings/[id]/approve`

### Admin – otros
- `GET /api/admin/affiliates`, `GET/PUT /api/admin/affiliates/[id]`, `GET/PUT /api/admin/affiliates/[id]/superadmin`
- `GET /api/admin/billing-summary`
- `GET/POST /api/admin/bot-memory`
- `GET/POST /api/admin/calculator-history/update-period-rates`
- `POST /api/admin/clean-history-data`, `clean-history-data-authenticated`
- `POST /api/admin/cleanup-empty-conversations`, `cleanup-inactive-users`
- `POST /api/admin/create-chat-tables`
- Rutas bajo `admin/daily-earnings-maintenance`, `admin/emergency-archive-p2/*`, `admin/process-historical-quincenal`
- `GET /api/admin/productivity-realtime`
- `POST /api/admin/setup-daily-earnings`, `setup-daily-avg-quincenal`, `setup-monthly-avg`
- `GET /api/admin/top-platforms`
- `POST /api/admin/unfreeze-platforms`
- `POST /api/admin/update-cron-schedule`, `update-monthly-connection-avg`, `update-quincenal-stats`

### Anticipos
- `GET/POST /api/anticipos`
- `GET /api/anticipos/paid`
- `GET/PUT/DELETE /api/anticipos/[id]`

### Chat
- `GET/POST /api/chat/aim-botty`, `GET /api/chat/aim-botty/diagnostics`
- `GET /api/chat/analytics`
- `POST /api/chat/auto-cleanup`, `cleanup`
- `POST /api/chat/broadcast`
- `GET /api/chat/conversations`
- `GET/POST /api/chat/messages`
- `POST /api/chat/messages/read`
- `POST /api/chat/notify-calculadora-restored`
- `GET /api/chat/test-realtime`
- `GET /api/chat/users`

### Otros
- `GET /api/ai-dashboard`
- `GET /api/aim-browser/platform-credentials`
- `GET/POST /api/announcements`
- `GET /api/announcements/categories`
- `POST /api/announcements/upload-image`
- `GET/PUT/DELETE /api/announcements/[id]`
- `GET/POST /api/audit`
- `GET /api/autoupload/dashboard`
- `POST /api/autoupload/upload`
- `POST /api/boost/upload-image`
- `POST /api/cleanup-all-model-data`
- `POST /api/cleanup-incorrect-portfolios`
- `GET /api/daily-earnings`
- `GET /api/daily-earnings/history`
- Rutas bajo `api/debug/*` (solo desarrollo/diagnóstico)
- `GET /api/gestor/historical-rates`
- `POST /api/gestor/historical-rates/apply`
- `GET/POST /api/gestor/stats/generate-sheet`
- `POST /api/gestor/stats/save-value`
- `GET /api/google-drive/auth`, `callback`, `folders`, `upload`, `verify-scope`
- `GET /api/sedes/disponibilidad`
- `GET/POST /api/shop/categories`, `checkout`, `inventory`, `inventory/transfer`
- `GET /api/shop/neto-disponible`
- `GET/POST /api/shop/orders`
- `GET/PUT /api/shop/orders/[id]`
- `GET/POST /api/shop/products`
- `GET/PUT/DELETE /api/shop/products/[id]`
- `GET /api/shop/promotions`
- `POST /api/shop/upload-image`
- `POST /api/sync-existing-portfolio`
- `POST /api/security/vx-leak-alert`

Las peticiones autenticadas suelen usar el header `Authorization: Bearer <access_token>` (token de Supabase Auth).

---

## 4. URL de producción

- **Sí, la URL correcta es:**  
  **https://iam-sistema-de-gestion.vercel.app**

---

## 5. Cómo obtener más detalle

- **Estructura del proyecto:** en la raíz del repo ejecutar `tree /F` (Windows) o `find . -type f -name "*.ts" -o -name "*.tsx" | head -200` y compartir el listado.  
- **Archivos clave:**  
  - `lib/supabase.ts` – cliente Supabase (front).  
  - `app/api/*/route.ts` – definición de cada endpoint.  
  - `db/*.sql` – esquemas y migraciones.  
  - `docs/flujo-sistema-roles.md` – flujos por rol.  
- **Repositorio:** el proyecto está en GitHub; con acceso se puede revisar la estructura y los archivos anteriores.  
- **Supabase:** desde el dashboard, en Table Editor o SQL Editor, se puede exportar o capturar el esquema de las tablas que use Desktop|AIM.

---

*Documento generado para integración Desktop|AIM. Última actualización: enero 2025.*
