# Sistema de Gestión AIM — Plan de Migración a Next.js + Vercel + Supabase (Postgres)

Objetivo: Migrar desde Google Apps Script (GAS) a Next.js (Vercel) con base de datos nueva en Supabase (Postgres), sin importar datos antiguos. No se realizan cambios en código en este paso.

## 1. Inventario de funciones GAS (referencia)

Origen principal: `Code.gs`, `IAM_Firebase_Core.gs`, `IAM_Firebase_Config.gs`, `IAM_WebInterface.html`.

- Render/Bootstrap (GAS)
  - `doGet()` → Render de `IAM_WebInterface` (HtmlService)

- Frontend API expuesta (wrappers usados por `google.script.run`)
  - `doLogin(email, password)`
  - `doValidateSession(token)`
  - `doGetUsers(token)`
  - `doCreateUser(token, userData)`
  - `doUpdateUser(token, userId, userData)`
  - `doDeleteUser(token, userId)`

- Core de dominio (usuarios, sesión, diagnósticos)
  - `firebase_validateSession(token)`
  - `firebase_getUsers(token)`
  - `firebase_createUser(token, userData)`
  - `firebase_updateUser(token, userId, userData)`
  - `firebase_deleteUser(token, userId)`
  - `firebase_initializeData()`
  - `simpleLogin(email, password)`
  - Pruebas/diagnóstico: `diagnosticarUsuarios()`, `probarConsultaEmail(email)`, `prueba1_ConexionFirestore()`, `prueba2_InicializacionDatos()`, `prueba3_LoginReal()`, `prueba4_CreacionUsuarios()`, `prueba5_ObtencionUsuarios()`, `pruebaCompleta_Sistema()`

- Capa Firestore REST (GAS → HTTP)
  - `getFirestore()` (objeto adaptor)
  - `firestoreGetCollection(name)` / `firestoreQueryCollection(name, field, op, value)`
  - `firestoreAddDocument(name, data)`
  - `firestoreGetDocument(name, id)`
  - `firestoreSetDocument(name, id, data)`
  - `firestoreUpdateDocument(name, id, data)`
  - `firestoreDeleteDocument(name, id)`
  - Formatos: `convertToFirestoreFields(data)`, `convertFirestoreDocument(fields)`
  - OAuth: `getFirebaseToken()`, `createJWT()`

- Configuración y utilidades
  - `FIREBASE_CONFIG`, `SERVICE_ACCOUNT_KEY` (constantes)
  - `getDefaultGroups()`, `getDefaultRoles()`
  - `validateFirebaseConfig()`
  - `generateUUID()`

## 2. Mapeo conceptual de GAS → Next.js

- Vistas HtmlService → Next.js App Router
  - HtmlService (`IAM_WebInterface.html`) → `/app/(auth)/login/page.tsx`, `/app/dashboard/page.tsx`, `/app/admin/users/page.tsx`
- doGet/doPost y wrappers `google.script.run` → API Routes
  - `doLogin` → `POST /app/api/auth/login/route.ts`
  - `doValidateSession` → `GET /app/api/auth/session/route.ts`
  - `doGetUsers` → `GET /app/api/users/route.ts`
  - `doCreateUser` → `POST /app/api/users/route.ts`
  - `doUpdateUser` → `PATCH /app/api/users/[id]/route.ts`
  - `doDeleteUser` → `DELETE /app/api/users/[id]/route.ts`
- Utilidades puras (formateos, validaciones) → `/lib/*`
  - Adaptadores y helpers REST → reemplazados por SDK Supabase/Prisma en `/lib/db.ts`, `/lib/auth.ts`, `/lib/validators/*`

Notas:
- En UI se sustituye `google.script.run` por `fetch`/`use server actions` según convenga.
- Se mantiene la marca “Sistema de Gestión AIM” y la estética visual actual.

## 3. Capa de datos: Prisma + Supabase (diseño de entidades)

Dominio declarado: modelos, chatters, ventas, productos/paquetes, movimientos de caja, costos operativos, usuarios.

- Entidades principales
  - `User` (rol: `super_admin`, `admin`, `modelo`, `chatter`)
  - `Group` (Cabecera, Diamante, Sede MP, Victoria, Terrazas, Satélite, Otros)
  - `Model` (perfil de modelo, puede vincularse 1:1 con `User` rol `modelo`)
  - `Chatter` (perfil de operador/chat)
  - `Product` (productos/paquetes)
  - `Sale` (venta de producto/paquete, asociada a modelo/chatter según proceso)
  - `CashMovement` (movimientos de caja: ingresos/egresos con categorías)
  - `OperatingCost` (costos operativos)
  - `Organization`/`Project` (scope multi-tenant opcional para RLS)
  - Tablas puente: `UserGroup`, relaciones N:M donde aplique

- Relaciones clave (resumen)
  - `Organization` 1:N `User`, `Model`, `Chatter`, `Sale`, `CashMovement`, `OperatingCost`
  - `User` 1:1 `Model` (opcional), 1:1 `Chatter` (opcional)
  - `Sale` N:1 `Product`, N:1 `Model` (o `Chatter` si procede), N:1 `User` (creador), N:1 `Organization`
  - `CashMovement` N:1 `Organization`, N:1 `User` (registrador), categoría enum
  - `OperatingCost` N:1 `Organization`

- Campos sugeridos (alto nivel)
  - `User`: `id (uuid)`, `email`, `name`, `role`, `isActive`, `createdAt`, `lastLogin`
  - `Model`: `id`, `userId`, `stageName`, `segments[]` (para futuras funciones), `createdAt`
  - `Chatter`: `id`, `userId`, `nickname`, `createdAt`
  - `Product`: `id`, `name`, `type` (producto/paquete), `price`, `currency`, `active`
  - `Sale`: `id`, `productId`, `modelId?`, `chatterId?`, `amount`, `currency`, `at`, `notes`
  - `CashMovement`: `id`, `type` (income/expense), `category`, `amount`, `currency`, `at`, `notes`
  - `OperatingCost`: `id`, `name`, `amount`, `currency`, `period` (mensual/semanal/único), `at`
  - Todas con `organizationId` para multi-tenant y RLS

- Esquema Prisma (borrador indicativo, no definitivo)
```prisma
model Organization {
  id             String   @id @default(uuid())
  name           String
  users          User[]
  models         Model[]
  chatters       Chatter[]
  products       Product[]
  sales          Sale[]
  cashMovements  CashMovement[]
  operatingCosts OperatingCost[]
  createdAt      DateTime @default(now())
}

model User {
  id             String   @id // igual a auth.users.id
  email          String   @unique
  name           String
  role           String   // 'super_admin' | 'admin' | 'modelo' | 'chatter'
  isActive       Boolean  @default(true)
  lastLogin      DateTime?
  organization   Organization @relation(fields: [organizationId], references: [id])
  organizationId String
  model          Model?
  chatter        Chatter?
  groups         UserGroup[]
  createdAt      DateTime @default(now())
}

model Group {
  id    String @id @default(uuid())
  name  String @unique // Cabecera, Diamante, Sede MP, Victoria, Terrazas, Satélite, Otros
  users UserGroup[]
}

model UserGroup {
  userId  String
  groupId String
  user    User  @relation(fields: [userId], references: [id])
  group   Group @relation(fields: [groupId], references: [id])
  @@id([userId, groupId])
}

model Model {
  id             String   @id @default(uuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  stageName      String?
  segments       String[]
  organizationId String
}

model Chatter {
  id             String   @id @default(uuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  nickname       String?
  organizationId String
}

model Product {
  id             String   @id @default(uuid())
  name           String
  type           String   // producto | paquete
  price          Decimal
  currency       String   // USD | COP | ...
  active         Boolean  @default(true)
  organizationId String
}

model Sale {
  id             String   @id @default(uuid())
  productId      String
  product        Product  @relation(fields: [productId], references: [id])
  modelId        String?
  model          Model?   @relation(fields: [modelId], references: [id])
  chatterId      String?
  chatter        Chatter? @relation(fields: [chatterId], references: [id])
  amount         Decimal
  currency       String
  at             DateTime @default(now())
  notes          String?
  organizationId String
}

model CashMovement {
  id             String   @id @default(uuid())
  type           String   // income | expense
  category       String
  amount         Decimal
  currency       String
  at             DateTime @default(now())
  notes          String?
  organizationId String
}

model OperatingCost {
  id             String   @id @default(uuid())
  name           String
  amount         Decimal
  currency       String
  period         String   // mensual | semanal | único
  at             DateTime @default(now())
  organizationId String
}
```

## 4. Estrategia de seguridad

- Autenticación: Supabase Auth (email/password, OAuth si se habilita). No almacenar contraseñas en tablas propias.
- Autorización: RLS por `organizationId`.
  - Regla base: un usuario solo accede a filas con su `organizationId`.
  - Admin/Super Admin: lectura global dentro de su organización; mutaciones según rol.
- Cuándo usar Service Role:
  - Solo en API Routes del backend para operaciones administrativas (crear usuarios, migraciones, tareas batch). Nunca exponer en cliente.
- Validación de roles:
  - Mantener campo `role` en `users` y reflejarlo en lógica de API (y opcionalmente en claims JWT vía Postgres functions).
- Auditoría:
  - Registrar acciones críticas (crear/eliminar usuarios, movimientos de caja, costos).

## 5. Fases, criterios de “hecho”, rollback y pruebas

- Fase 1: Infraestructura mínima
  - Hecho: Proyecto Next.js en Vercel, variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` configuradas.
  - Pruebas: Ping a `/app/api/health` y conexión a Supabase.
  - Rollback: si falla, revertir deploy a previo en Vercel.

- Fase 2: Autenticación y perfiles
  - Hecho: Registro/login con Supabase Auth; tabla `users` sincronizada (profile básico) y RLS activas.
  - Pruebas: login, acceso a recurso protegido, denegación a usuario sin rol.
  - Rollback: deshabilitar rutas nuevas, volver a versión anterior.

- Fase 3: Gestión de usuarios (CRUD)
  - Hecho: Endpoints `/api/users` GET/POST/PATCH/DELETE con políticas de rol; UI admins.
  - Pruebas: CRUD completo y verificación RLS con usuario `modelo`.
  - Rollback: feature flag para ocultar módulos.

- Fase 4: Ventas, productos/paquetes
  - Hecho: Tablas `Product`, `Sale`, endpoints, UI básica.
  - Pruebas: creación/listado, restricciones por organización.
  - Rollback: desactivar rutas y navegación.

- Fase 5: Caja y costos operativos
  - Hecho: `CashMovement`, `OperatingCost` con validaciones, UI.
  - Pruebas: registros de ingreso/egreso, agregados.
  - Rollback: idem fases previas.

- Fase 6: Observabilidad, auditoría y endurecimiento
  - Hecho: logs de auditoría, métricas, alertas básicas.
  - Pruebas: escenarios de error 4xx/5xx, latencia.
  - Rollback: reversible por deploy.

## 6. Riesgos y mitigaciones

- Autenticación/Autorización
  - Riesgo: RLS mal configurada expone datos entre organizaciones.
  - Mitigación: pruebas con usuarios de diferentes organizaciones, políticas explícitas por tabla, revisiones de seguridad.

- Cuotas y límites (Supabase/Vercel)
  - Riesgo: superación de límites (filas, RPS, almacenamiento) o throttling.
  - Mitigación: paginación, índices, caché ligera (ISR/SWR), monitoreo de cuotas.

- CORS
  - Riesgo: errores de CORS si dominios separados o preflight.
  - Mitigación: servir front y API desde el mismo dominio en Vercel; configurar headers en rutas API.

- Cold starts y latencia
  - Riesgo: latencia inicial en funciones serverless.
  - Mitigación: rutas agrupadas, evitar dependencias pesadas, usar Node runtimes soportados, edge runtime si aplica.

- Service role expuesto
  - Riesgo: fuga de `SERVICE_ROLE_KEY`.
  - Mitigación: solo en backend; rotación de claves; escaneo de secretos; revisión de permisos del proyecto Supabase.

- Datos críticos y consistencia
  - Riesgo: operaciones parciales en transacciones (ventas/caja).
  - Mitigación: usar transacciones (RPC/pg) cuando se afecten múltiples tablas.

---

Este plan guía la migración sin importar datos antiguos y sin cambiar el código existente en esta etapa.
