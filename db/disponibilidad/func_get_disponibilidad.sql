-- =====================================================
-- FUNCIÓN: get_disponibilidad_por_sedes
-- =====================================================
-- Ejecutar en Supabase SQL Editor (Database > SQL Editor).
-- Replica exactamente la lógica del diagnóstico que funciona.
-- SECURITY DEFINER = corre con privilegios del owner, bypass RLS.
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
    (COALESCE(c.asignaciones, 0) < 2) AS disponible
  FROM slots s
  LEFT JOIN conteo_por_slot c ON c.room_id = s.rid AND c.jornada = s.jname
  ORDER BY s.sname, s.rname, s.jname;
$$;

-- Permitir llamada desde Service Role y Anon
GRANT EXECUTE ON FUNCTION get_disponibilidad_por_sedes(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION get_disponibilidad_por_sedes(UUID[]) TO anon;


-- =====================================================
-- DIAGNÓSTICO: Ejecutar ANTES de probar la función
-- =====================================================

-- A. Ver grupos y sus rooms (para obtener IDs correctos)
SELECT g.id, g.name, COUNT(gr.id) as num_rooms
FROM groups g
LEFT JOIN group_rooms gr ON gr.group_id = g.id
WHERE g.name NOT IN ('Otros', 'Satélites')
GROUP BY g.id, g.name
ORDER BY g.name;

-- B. Probar función con TODAS las sedes operativas (debería devolver filas)
SELECT * FROM get_disponibilidad_por_sedes(
  (SELECT array_agg(id) FROM groups WHERE name NOT IN ('Otros', 'Satélites'))
);

-- C. Probar solo Sede MP (ajusta el nombre si es diferente en tu BD)
-- SELECT * FROM get_disponibilidad_por_sedes(
--   ARRAY[(SELECT id FROM groups WHERE name ILIKE '%Sede MP%' OR name ILIKE '%MP%' LIMIT 1)]::UUID[]
-- );
