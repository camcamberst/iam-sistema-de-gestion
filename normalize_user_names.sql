-- Normalizar nombres existentes en la tabla users
-- Acciones:
-- 1) trim de espacios al inicio/fin
-- 2) colapsar múltiples espacios intermedios a uno solo
-- 3) quitar espacio antes de signos de puntuación comunes (, . ; :)
-- 4) aplicar Title Case básico con initcap

-- Vista previa (opcional):
-- SELECT id,
--        name AS original,
--        initcap(
--          regexp_replace(
--            regexp_replace(trim(name), '\\s+', ' ', 'g'),
--            '\\s+([,.;:])', '\\1', 'g'
--          )
--        ) AS normalized
-- FROM users
-- WHERE name IS NOT NULL AND name <> ''
-- LIMIT 50;

-- Actualización en bloque:
UPDATE users
SET name = initcap(
             regexp_replace(
               regexp_replace(trim(name), '\\s+', ' ', 'g'),
               '\\s+([,.;:])', '\\1', 'g'
             )
           )
WHERE name IS NOT NULL
  AND name <> ''
  AND name <> initcap(
                regexp_replace(
                  regexp_replace(trim(name), '\\s+', ' ', 'g'),
                  '\\s+([,.;:])', '\\1', 'g'
                )
              );

-- Verificación rápida:
-- SELECT COUNT(*) AS updated
-- FROM users
-- WHERE name = initcap(
--               regexp_replace(
--                 regexp_replace(trim(name), '\\s+', ' ', 'g'),
--                 '\\s+([,.;:])', '\\1', 'g'
--               )
--             );


