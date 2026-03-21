# Canal seguro de cambios (producción)

Objetivo: **no afectar a los usuarios** en producción salvo cuando un cambio esté revisado y probado en preview.

## 1. Ramas y nombres

| Prefijo   | Uso |
|-----------|-----|
| `feat/`   | Nueva funcionalidad |
| `fix/`    | Corrección de bug |
| `chore/`  | Mantenimiento, docs, estilos sin lógica |
| `refactor/` | Refactor interno (misma conducta, código distinto) |

Ejemplos: `feat/chat-filtros`, `fix/calculadora-freeze`, `chore/ui-historial-header`.

## 2. Regla de `main`

- **`main` = listo para producción** (Vercel/production suele desplegar desde aquí).
- **No subir cambios directos a `main`** salvo emergencia acordada (hotfix con rollback planificado).
- Flujo habitual: **crear rama → commits → Pull Request → revisar → merge a `main`**.

## 3. Pull Request (PR)

Cada PR debe:

1. Tener **alcance acotado** (ideal: un tema por PR; evitar mezclar UI + API + DB en el mismo merge).
2. Incluir en la descripción **qué se tocó** y **cómo probarlo** (rutas, rol de usuario).
3. Pasar **build/lint** en CI o local (`npm run build` como mínimo antes de pedir merge).
4. Ser probado en **Deploy Preview** (ver siguiente apartado) cuando el cambio sea visible en UI o afecte flujos críticos.

## 4. Vercel / preview (obligatorio para cambios visibles o sensibles)

- En el proyecto de Vercel, mantener activos los **Deploy Previews** para PRs.
- Antes de merge a `main`: validar en la **URL del preview** con el mismo tipo de usuario (admin, modelo, etc.) que en producción.
- Producción solo después de merge; los usuarios finales no deberían ver cambios “a ciegas”.

## 5. Cambios solo cosméticos vs con riesgo

| Tipo | Qué incluye | Riesgo |
|------|-------------|--------|
| **Cosmético** | Clases Tailwind, espaciados, tipografía, colores, bordes (sin tocar handlers, estado, APIs) | Bajo; revisar dropdowns, modales, scroll y `z-index` |
| **Con riesgo** | Lógica, rutas, Supabase, RLS, APIs, `useEffect`, permisos | Alto; exige preview + pruebas explícitas |

## 6. Base de datos (Supabase)

- Scripts SQL en `db/` o migraciones: probar en **entorno de staging** o proyecto de prueba cuando exista.
- En producción: backup / plan de rollback y ventana acordada si el cambio es destructivo o irreversible.

## 7. Rollback

- **Código**: revert del merge en Git o redeploy del último deployment estable en Vercel.
- **Datos**: dependerá de backups y migraciones reversibles; documentar en el PR si aplica.

## 8. Hooks de Git (pre-commit)

- Preferir **arreglar** lo que fallen los hooks (lint, validaciones de modales, etc.).
- Usar `--no-verify` solo en casos excepcionales y dejar constancia en el PR.

---

**Resumen en una línea:** rama → PR → preview → merge a `main` → producción; un cambio por PR cuando sea posible; cosmético separado de lógica y de BD.
