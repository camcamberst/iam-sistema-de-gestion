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
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH conteo_por_slot AS (
    SELECT room_id, jornada, COUNT(*)::BIGINT as asignaciones
    FROM room_assignments
    GROUP BY room_id, jornada
  ),
  slots AS (
    SELECT 
      g.id as gid,
      g.name as sname,
      gr.id as rid,
      gr.room_name as rname,
      j.jornada as jname
    FROM groups g
    JOIN group_rooms gr ON gr.group_id = g.id
    CROSS JOIN (VALUES ('MAÑANA'), ('TARDE'), ('NOCHE')) AS j(jornada)
    WHERE g.id = ANY(p_sede_ids)
  )
  SELECT 
    s.gid,
    s.sname,
    s.rid,
    s.rname,
    s.jname,
    COALESCE(c.asignaciones, 0),
    (COALESCE(c.asignaciones, 0) < 2)
  FROM slots s
  LEFT JOIN conteo_por_slot c ON c.room_id = s.rid AND c.jornada = s.jname
  ORDER BY s.sname, s.rname, s.jname;
END;
$$;

-- Probar con Sede MP (reemplaza el UUID por el de tu Sede MP):
-- SELECT * FROM get_disponibilidad_por_sedes(ARRAY[(SELECT id FROM groups WHERE name = 'Sede MP')]::UUID[]);
