# Diagnóstico de Disponibilidad - Rooms y Jornadas

## Cómo ejecutar

1. Abre **Supabase Dashboard** → **SQL Editor**
2. Ejecuta cada sección del archivo `diagnostico_disponibilidad.sql` **por separado** (selecciona el bloque y ejecuta)
3. Anota los resultados

## Qué nos dirá cada consulta

| # | Consulta | Qué verás |
|---|----------|-----------|
| 1 | Existencia de tablas | Si existen `room_assignments`, `jornada_states`, `modelo_assignments`, `group_rooms`, `groups` |
| 2 | Estructura jornada_states | Columnas (group_id, sede_id, room_id, etc.) |
| 3 | Conteo de registros | Cuántas filas hay en cada tabla de asignaciones |
| 4 | room_assignments detalle | Asignaciones actuales con sede, room, jornada y modelo |
| 5 | modelo_assignments detalle | Asignaciones activas (por si se usa) |
| 6 | **Query de disponibilidad** | Tabla (sede, room, jornada, asignaciones, estado Disponible/Ocupado) |
| 7 | Resumen por sede | Total slots, ocupados, disponibles por sede |

## Interpretación

- Si **room_assignments** tiene 0 registros pero ves asignaciones en Gestión Sedes → hay un problema de sincronización o la tabla no se está usando.
- Si **room_assignments** tiene datos pero la query 6 muestra todo Disponible → revisar que `room_id` en room_assignments coincida con `group_rooms.id`.
- Si **jornada_states** existe y tiene datos → podemos usarla como fuente adicional o principal.

## Próximo paso

Con los resultados podremos ajustar la API `/api/sedes/disponibilidad` para usar la fuente correcta.
