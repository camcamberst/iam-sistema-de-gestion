# Mapeo de Funciones GAS → Módulos Next.js (Vercel)

| Función GAS | Nuevo módulo Next | Dependencias | Estado |
| --- | --- | --- | --- |
| `doGet()` (render HtmlService) | `/app/(auth)/login`, `/app/dashboard`, `/app/admin/users` | Next.js App Router | Planificado |
| `doLogin(email, password)` | `POST /app/api/auth/login/route.ts` | Supabase Auth (SDK), Prisma opcional | Planificado |
| `doValidateSession(token)` | `GET /app/api/auth/session/route.ts` | Supabase Auth (getUser), cookies | Planificado |
| `doGetUsers(token)` | `GET /app/api/users/route.ts` | Prisma (Supabase), RLS/role guard | Planificado |
| `doCreateUser(token, userData)` | `POST /app/api/users/route.ts` | Supabase Admin API, Prisma | Planificado |
| `doUpdateUser(token, userId, userData)` | `PATCH /app/api/users/[id]/route.ts` | Prisma, role guard | Planificado |
| `doDeleteUser(token, userId)` | `DELETE /app/api/users/[id]/route.ts` | Prisma, role guard | Planificado |
| `firebase_validateSession(token)` | `/lib/auth.ts` (helpers) | Supabase SDK | Planificado |
| `firebase_getUsers(token)` | `/app/api/users/route.ts` | Prisma (queries), RLS | Planificado |
| `firebase_createUser(token, userData)` | `/app/api/users/route.ts` | Supabase Admin + Prisma | Planificado |
| `firebase_updateUser(token, userId, userData)` | `/app/api/users/[id]/route.ts` | Prisma | Planificado |
| `firebase_deleteUser(token, userId)` | `/app/api/users/[id]/route.ts` | Prisma | Planificado |
| `firebase_initializeData()` | Script seed `/scripts/seed.ts` | Prisma (seed), Service role | Planificado |
| `simpleLogin(email, password)` | `POST /app/api/auth/login/route.ts` | Supabase Auth | Planificado |
| `diagnosticarUsuarios()` | `/app/api/users/diagnostics/route.ts` (opcional) | Prisma | Planificado |
| `prueba*_…` | `/app/api/health` (con checks) | Supabase/Prisma | Planificado |
| Adaptadores Firestore REST | Reemplazados por Supabase + Prisma | Supabase SDK, Prisma | No aplica |
| `getDefaultGroups()`, `getDefaultRoles()` | `/lib/constants.ts` | - | Planificado |
| `generateUUID()` | Usar `crypto.randomUUID()` | Node runtime | Planificado |

Notas:
- Las vistas HTML se portan a componentes React manteniendo la estética.
- Las llamadas `google.script.run` se sustituyen por `fetch` a las rutas API.
