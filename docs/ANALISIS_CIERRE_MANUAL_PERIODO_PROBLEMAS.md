# Análisis profundo: posibles problemas del Cierre Manual de Período

Este documento resume todos los riesgos y puntos de fallo identificados en el flujo de **Cierre Manual de Período** (archivado + limpieza), incluyendo API, base de datos, fechas y frontend.

---

## 1. Problemas ya corregidos o conocidos

### 1.1 Columna `users.active` → `users.is_active`
- **Estado:** Corregido en `archive-period/route.ts` (línea 164: `.eq('is_active', true)`).
- **Riesgo residual:** Si en otro entorno la tabla `users` tiene `active` en lugar de `is_active`, el error volvería a aparecer. Conviene unificar el nombre en todo el proyecto y en migraciones.

### 1.2 Inicialización de Supabase en cliente
- **Estado:** Resuelto en páginas como solicitar ahorro/retiro usando `supabase` solo en `useEffect` y comprobando que exista.
- **Riesgo residual:** Las rutas API usan `createClient` con variables de entorno en el servidor; si `NEXT_PUBLIC_SUPABASE_URL` o `SUPABASE_SERVICE_ROLE_KEY` no están definidas en el servidor, las rutas fallarán sin un mensaje claro.

---

## 2. Base de datos y esquemas

### 2.1 **CRÍTICO: Tabla `calc_snapshots` – dos esquemas distintos**

El archivo `db/calculadora/create_calc_snapshots_table.sql` define:

- `id`, `model_id`, `period_id` (UUID), `totals_json`, `rates_applied_json`, `created_at`

En cambio, `archive-period/route.ts` en `createPeriodSnapshot()` inserta:

- `period_date`, `period_type`, `snapshot_data` (objeto), `created_by`

**Consecuencia:** Si la tabla en Supabase solo tiene el esquema del SQL (sin columnas `period_date`, `period_type`, `snapshot_data`, `created_by`), el insert fallará con error del tipo “column does not exist”.

**Recomendación:**

- Opción A: Añadir migración que agregue `period_date`, `period_type`, `snapshot_data` (jsonb), `created_by` a `calc_snapshots` y usar ese esquema “consolidado” solo para el cierre manual.
- Opción B: Cambiar `createPeriodSnapshot()` para que guarde un registro por modelo con `model_id`, `period_id`, `totals_json`, `rates_applied_json` (como en `lib/calculator/period-closure-helpers.ts`), de forma compatible con el esquema actual.

### 2.2 `calculator_history` – columna `estado`

En `db/gestor/extend_calculator_history_for_gestor.sql`, `estado` acepta:

- `'pendiente_auditoria' | 'en_auditoria' | 'auditado' | 'rechazado' | 'corregido'` (o NULL).

El archivado escribe `estado: 'auditado'`, que está dentro del CHECK. Si en algún entorno no se ha ejecutado esta extensión y `estado` no existe o tiene otro CHECK, el insert fallaría.

**Recomendación:** Confirmar en Supabase que la columna `estado` existe y que su CHECK incluye `'auditado'`.

### 2.3 RPC `calculate_period_totals`

En `cleanup-period/route.ts`, `validateBeforeCleanup()` llama:

```ts
supabase.rpc('calculate_period_totals', { p_period_date: periodDate })
```

Ese resultado solo se usa para logging (no bloquea la validación). Si la función no existe en la base de datos, la llamada RPC fallará y puede romper `validateBeforeCleanup` si el error no está manejado.

**Recomendación:** Envolver la llamada en try/catch y, si falla, solo registrar un warning y continuar; o verificar en BD que la función exista y, si no, no llamarla.

### 2.4 Tablas que deben existir

El flujo asume que existen:

- `period_closure_locks`, `period_closure_audit_log`, `archived_model_values` (FASE1_MANUAL_PERIOD_CLOSURE_SYSTEM.sql)
- `calculator_period_closure_status` (update en cleanup)
- `calculator_frozen_platforms` (unfreeze en cleanup)
- `announcements` (anuncio de Botty en cleanup)

Si alguna no existe o tiene otro nombre, las operaciones correspondientes fallarán. Útil tener un script de verificación de tablas antes del primer cierre.

### 2.5 RLS en tablas de cierre

En `FASE1_MANUAL_PERIOD_CLOSURE_SYSTEM.sql` las políticas usan `auth.uid()`. Las rutas API usan **service role**, que normalmente bypasea RLS. Si en el futuro se usara un cliente con anon key para estas operaciones, habría que asegurar políticas de INSERT/UPDATE/DELETE además de SELECT.

---

## 3. Relación `user_groups` y filtro por grupos

### 3.1 Estructura de `groups` en el usuario

En `archive-period/route.ts` se hace:

```ts
.select('id, name, email, affiliate_studio_id, groups:user_groups(group_id)')
```

y luego:

```ts
user.groups?.map((g: any) => g.group_id)
```

En Supabase/PostgREST, la relación suele devolverse como array de objetos con la FK; el alias `groups:user_groups(group_id)` puede devolver `{ group_id: "..." }` por elemento. Si en tu BD la relación se llama distinto (por ejemplo solo `user_groups` sin alias `groups`), `user.groups` podría ser `undefined` y un admin quedaría con `userGroupIds.length === 0` y recibir “Admin sin grupos asignados” aunque sí tenga grupos.

**Recomendación:** Verificar en respuesta real de la API (o logs) la forma exacta del objeto usuario (nombre de la clave: `groups` vs `user_groups`) y que `group_id` esté presente. Ajustar el código según la estructura real.

### 3.2 Admin sin grupos

Si el rol es `admin` y `userGroupIds.length === 0`, se devuelve 403 “Admin sin grupos asignados”. Está bien como regla de negocio; solo asegurar que los admins tengan al menos un `user_groups` asignado cuando deban usar el cierre manual.

### 3.3 Modelos y filtro por grupo

Para cada modelo se hace:

```ts
(model as any).groups?.map((g: any) => g.group_id)
```

Misma precaución: si la relación no viene como `groups` o no trae `group_id`, los modelos podrían filtrarse mal (ninguno o demasiados). Conviene validar con un usuario admin real y un modelo con grupo conocido.

---

## 4. Fechas y timezone

### 4.1 Cálculo en servidor vs cliente

`getColombiaDate()`, `isClosureDay()`, `getPeriodToClose()` usan `new Date()` y `America/Bogota`. En Vercel/serverless la hora del servidor suele ser UTC; `toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })` está bien para que el “día” sea el de Colombia. Riesgo: si en el futuro alguien cambia a “fecha del servidor” sin timezone, los días 1 y 16 podrían cambiar según el despliegue.

### 4.2 Día 1 y 16 estrictos

`isClosureDay()` solo devuelve true los días 1 y 16. Si el negocio quisiera permitir ejecutar el cierre el 2 o el 17 “por excepción”, no hay opción; habría que añadir un override (por ejemplo variable de entorno o flag) y usarlo con cuidado.

### 4.3 `getPeriodToClose()` fuera de días 1 y 16

Si se llama un día que no es 1 ni 16, la función hace un “fallback” y devuelve período según el día actual. Ese valor se usa en el catch del archive (audit log) y en otras comprobaciones. No es incorrecto, pero el “período a cerrar” en esos casos no es el que se usaría en un cierre real; tenerlo en cuenta al revisar logs.

---

## 5. Concurrencia y locks

### 5.1 Lock de 30 minutos

`acquire_period_closure_lock` expira a los 30 minutos. Si el archivado tarda más (muchos modelos o red lenta), el lock podría quedar como “activo” en la app pero expirado en BD. La función `cleanup_expired_locks()` marca como `expired` los que pasaron su tiempo; un segundo intento podría adquirir un nuevo lock. Riesgo: si no se llama `cleanup_expired_locks()` antes de cada adquisición en todas las rutas que usan locks, podría haber ventanas raras. En el SQL actual sí se llama al inicio de `acquire_period_closure_lock`, está bien.

### 5.2 Liberación del lock en errores

En `archive-period` y `cleanup-period`, en el `catch` se llama a `release_period_closure_lock` si `lockId` existe. Si el fallo ocurre **después** de adquirir el lock pero **antes** de asignar `lockId` (p. ej. error al escribir en audit_log justo después del acquire), en teoría no se liberaría. Revisando el código, `lockId` se asigna en seguida al acquire; el único riesgo sería una excepción entre el RPC y la asignación. Recomendación: asignar `lockId` en el mismo bloque que el RPC y, si se quiere ser muy defensivo, en un `finally` asegurar la liberación cuando el status siga siendo `active`.

### 5.3 Dos operaciones distintas (archive vs cleanup)

Archive y cleanup usan el mismo `period_date` y `period_type` pero `operation_type` distinto ('archive' vs 'cleanup'). El lock es por (period_date, period_type, operation_type), así que no se bloquean entre sí. Eso permite que alguien pueda intentar limpiar mientras otro archiva; la validación “debe existir historial” en cleanup mitiga, pero no evita que dos usuarios corran archive a la vez para el mismo período. El lock de archive sí evita dos archives simultáneos. Revisar si en la UI se debe deshabilitar “Paso 2” hasta que “Paso 1” termine.

---

## 6. Validación previa a la limpieza

### 6.1 `validateBeforeCleanup`

- Comprueba que existan registros en `calculator_history` para el período.
- Comprueba que todos los modelos con datos en `model_values` tengan historial (no queden modelos con valores sin archivar).
- Snapshot en `calc_snapshots`: si no hay, se añade un error “recomendable” (no bloqueante en el código actual; revisar si debe ser bloqueante).
- Lock activo de tipo “archive”: si hay uno activo, se bloquea la limpieza. Correcto.

### 6.2 Posible race entre archive y cleanup

Si un admin ejecuta cleanup justo cuando otro acaba de crear el último registro de `calculator_history` pero aún no ha terminado de escribir en `calc_snapshots`, la validación podría pasar y luego el snapshot quedar incompleto. El riesgo es bajo si el archive es secuencial y el snapshot se escribe al final; aun así, el orden actual (historial → snapshot) está bien.

### 6.3 RPC `calculate_period_totals`

Ya comentado: si no existe, puede hacer fallar toda la validación. Envolver en try/catch o comprobar existencia de la función.

---

## 7. Soft delete y cleanup

### 7.1 Inserción en `archived_model_values`

Los registros se construyen con `id: v.id` (el mismo UUID de `model_values`). La tabla `archived_model_values` tiene PK `id`. Si por algún motivo ya existiera un registro con ese `id` (por una ejecución anterior fallida a medias), el insert podría fallar por duplicado. Recomendación: en entorno de producción, si hay reintentos o ejecuciones parciales, considerar `ON CONFLICT` o comprobar existencia antes de insertar.

### 7.2 Orden: insert archivo → delete `model_values`

En `softDeleteModelValues` primero se inserta en `archived_model_values` y luego se borra de `model_values`. Si el delete falla, quedan duplicados (archivo + activo). Sería más seguro usar una transacción o un procedimiento en BD que haga ambos pasos atómicos. Con Supabase cliente no hay transacción multi-tabla; podría implementarse vía RPC en PostgreSQL.

### 7.3 Unfreeze: `.neq('id', '00000000-0000-0000-0000-000000000000')`

En `unfreezeAllCalculators()` se hace:

```ts
.delete().neq('id', '00000000-0000-0000-0000-000000000000')
```

En PostgreSQL, `id != '00000000-...'` es true para todos los UUIDs normales, así que en la práctica borra todos los registros de la tabla. Si la intención es “borrar todos”, es preferible algo explícito (p. ej. borrar por `period_date` o por un flag) para no depender de que ningún id sea ese UUID nulo. Funciona, pero es frágil ante cambios de esquema o de significado del id.

---

## 8. Auditoría y errores

### 8.1 Audit log en el catch (archive)

En el `catch` de archive-period se inserta en `period_closure_audit_log` con `user_id: userId`. Si el error ocurre antes de asignar `userId` (p. ej. body sin `userId`), `userId` sería el del body que ya se validó; en ese flujo normalmente ya está asignado. Si el error fuera en el primer `request.json()` o en algo muy temprano, `userId` podría no estar asignado; el insert usa `userId` y podría fallar o escribir null según el esquema. Revisar que las columnas obligatorias del audit_log tengan valor cuando se registra el error (y que `userId` se asigne lo antes posible tras validar el body).

### 8.2 Respuesta HTTP en errores

Cuando hay excepción, se devuelve `NextResponse.json({ success: false, error: error.message }, { status: 500 })`. Si `error` no es una instancia de `Error` (p. ej. un objeto o string), `error.message` puede ser undefined. Mejor: `error?.message ?? String(error)` para evitar respuestas vacías.

---

## 9. Frontend (ManualPeriodClosure)

### 9.1 Errores de API

Si la API devuelve 4xx/5xx, el componente hace `throw new Error(data.error || 'Error desconocido')` y lo guarda en `setError(err.message)`. Si la respuesta no es JSON (por ejemplo error de red o 502), `data` podría ser undefined y `data.error` fallaría al acceder. Conviene algo del estilo:

```ts
const data = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(data?.error || res.statusText || 'Error desconocido');
```

### 9.2 Polling sin `periodDate` en dependencias

El `useEffect` que hace polling cada 30 segundos no incluye `userId` ni `periodToClose` en el array de dependencias. Si `userId` o la fecha cambiaran (poco común en la misma sesión), el polling seguiría usando el estado inicial. Para esta pantalla suele ser aceptable; si en el futuro se permitiera elegir período, habría que añadir dependencias.

### 9.3 Resultado parcial (algunos modelos fallan)

Cuando hay `archiveResult.partial`, se muestra un mensaje con “X modelos fallaron. Revisa el log.” No se listan los modelos fallidos en la UI; están en `archiveResult.partial.failed_models`. Sería útil mostrar al menos la lista (nombre/email + error) para que el admin sepa a quién revisar.

### 9.4 Paso 2 habilitado sin paso 1 en otra pestaña

Si un admin tiene dos pestañas y en una ejecuta el Paso 1 y en la otra no se ha refrescado el estado, podría intentar el Paso 2 antes de que el GET de validación vea el historial. El polling cada 30 s reduce el riesgo; para más seguridad se podría refrescar estado justo antes de abrir el modal de limpieza.

---

## 10. Variables de entorno y despliegue

- `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` deben estar definidas en el entorno donde corren las API routes (Vercel, etc.). Si faltan, `createClient` recibirá `undefined` y Supabase fallará en la primera llamada.
- `maxDuration = 300` en las rutas permite hasta 5 minutos; en Vercel el plan puede tener un límite menor (por ejemplo 60 s). Si el archivado tarda más, la función será cortada y el lock podría quedar activo hasta que expire o se limpie manualmente.

---

## 11. Resumen de acciones recomendadas

| Prioridad | Acción |
|-----------|--------|
| Alta | Resolver discrepancia de esquema de `calc_snapshots` (migración o adaptar `createPeriodSnapshot` al esquema actual). |
| Alta | Asegurar que `calculate_period_totals` exista en BD o que su llamada esté en try/catch y no rompa la validación. |
| Media | Verificar en producción la estructura real de `user.groups` / `user_groups` y que el filtro por grupos devuelve los modelos esperados. |
| Media | Manejar respuestas no-JSON y `error.message` en frontend y en respuestas de error de la API. |
| Media | Opcional: transacción o RPC en BD para “insert archivo + delete model_values” atómico. |
| Baja | Mostrar en la UI la lista de modelos fallidos cuando el archivado es parcial. |
| Baja | Revisar uso de `.neq('id', '00000000-...')` en unfreeze y sustituir por un criterio más explícito si se puede. |

Si compartes logs del navegador (consola o pestaña Network) en el momento en que falla “Paso 1” o “Paso 2”, se puede acotar si el fallo es por `calc_snapshots`, por `users.is_active`, por `user_groups` o por otro punto de esta lista.
