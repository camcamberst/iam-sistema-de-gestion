-- =====================================================
-- FUNCIÓN: get_disponibilidad_por_sedes
-- =====================================================
-- Replica la lógica del SQL que funciona. Ejecutar en Supabase SQL Editor.
-- La API llamará a esta función para garantizar resultados correctos.
-- =====================================================

CREATE OR REPLACE FUNCTION get_disponibilidad_por_sedes(p_sede_ids UUID[])
RETURNS TABLE (
  sede_id UUID,
  sede_nombre TEXT,
  room_id UUID,
  room_name TEXT,
  jornada TEXT,
  asignaciones BIGINT,
  disponible BOOLEAN
)
LANGUAGE plpgsql
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH conteo_por_slot AS (
    SELECT ra.room_id, ra.jornada, COUNT(*)::BIGINT AS asignaciones
    FROM room_assignments ra
    GROUP BY ra.room_id, ra.jornada
  ),
  slots AS (
    SELECT 
      g.id AS gid,
      g.name AS sname,
      gr.id AS rid,
      gr.room_name AS rname,
      j.jornada AS jname
    FROM groups g
    JOIN group_rooms gr ON gr.group_id = g.id
    CROSS JOIN (VALUES ('MAÑANA'), ('TARDE'), ('NOCHE')) AS j(jornada)
    WHERE g.id = ANY(p_sede_ids)
  )
  SELECT 
    s.gid AS sede_id,
    s.sname AS sede_nombre,
    s.rid AS room_id,
    s.rname AS room_name,
    s.jname AS jornada,
    COALESCE(c.asignaciones, 0)::BIGINT AS asignaciones,
    (COALESCE(c.asignaciones, 0) = 0) AS disponible
  FROM slots s
  LEFT JOIN conteo_por_slot c ON c.room_id = s.rid AND c.jornada = s.jname
  ORDER BY s.sname, s.rname, s.jname;
-- Probar con Sede MP (reemplaza el UUID por el de tu Sede MP):
-- SELECT * FROM get_disponibilidad_por_sedes(ARRAY[(SELECT id FROM groups WHERE name = 'Sede MP')]::UUID[]);
