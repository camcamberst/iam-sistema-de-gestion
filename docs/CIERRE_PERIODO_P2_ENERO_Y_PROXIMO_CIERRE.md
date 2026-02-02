# P2 enero: archivo histórico y próximo cierre de período

## 1. Crear el archivo histórico de P2 enero (16-31 enero 2026)

**Objetivo:** Copiar los datos de P2 enero desde `model_values` a `calculator_history` para que las modelos vean el período en "Mi Historial". No se borra nada de `model_values`.

**Quién:** Solo un usuario con rol **super_admin**.

**Pasos:**

1. Iniciar sesión con una cuenta **super_admin**.
2. Ir al **Dashboard de Sedes** (donde está el bloque de cierre manual).
3. En la sección **"P2 enero (16-31)"**:
   - Pulsar **"Ver estado"** para comprobar cuántos registros hay en `model_values` (rango 16-31) y cuántos en `calculator_history`.
   - Si hace falta archivar: pulsar **"Archivar P2 enero a historial"**.

**Qué hace la acción de archivar:**

- Lee todos los `model_values` con `period_date` entre **2026-01-16** y **2026-01-31**.
- Agrupa por `(model_id, platform_id)` y suma `value`.
- Inserta en `calculator_history` una fila por plataforma y una fila consolidada (`__CONSOLIDATED_TOTAL__`) por modelo, con `period_date = 2026-01-16` y `period_type = 16-31`.
- Solo inserta columnas básicas: `model_id`, `period_date`, `period_type`, `platform_id`, `value`.
- No inserta duplicados: si ya existe el período para ese modelo/plataforma, se omite.

**Alternativa por SQL:** Si prefieres ejecutar en Supabase SQL Editor, usa el script `db/insertar_p2_enero_MINIMO.sql` (ejecutar la PREVIA para ver cuántas filas se insertarían y luego los dos INSERT).

---

## 2. Dejar listo el próximo cierre de período

**Ajustes ya hechos:**

- Solo **super_admin** puede ejecutar el cierre (Paso 1: Crear archivo histórico y Paso 2: Limpiar). Así se evitan duplicados y conflictos.
- El bloque "Cierre manual de período" en el Dashboard de Sedes **solo se muestra** a usuarios con rol `super_admin`.

**Próximo cierre (ej. día 1 o 16):**

1. Entrar con **super_admin**.
2. Ir al **Dashboard de Sedes**.
3. El **día 1** o **día 16** del mes:
   - **Paso 1: Crear archivo histórico** → archiva el período que toque (16-31 del mes anterior o 1-15 del mes actual) en `calculator_history`.
   - Cuando el Paso 1 termine bien, se habilita **Paso 2: Limpiar** → mueve `model_values` a `archived_model_values`, resetea `calculator_totals` y descongela calculadoras.

**Nota P2 enero:** Si el próximo cierre es el **1 de febrero** (período a cerrar = P2 enero 16-31), el Paso 2 tiene una protección: no permite limpiar P2 enero sin confirmación. Si ya archivaste P2 enero con la acción "Archivar P2 enero a historial", puedes ejecutar el Paso 2 enviando `force: "2026-01-16"` (o usar el botón correspondiente si la UI lo expone) cuando quieras limpiar ese período.
