-- =====================================================
-- 🔧 FUNCIONES RPC PARA ANUNCIOS (OPCIONAL)
-- =====================================================
-- Funciones auxiliares para operaciones comunes
-- =====================================================

-- Función para incrementar contador de visualizaciones
-- (Alternativa a hacerlo directamente en el código)
CREATE OR REPLACE FUNCTION increment_announcement_views(announcement_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE announcements
  SET views_count = views_count + 1
  WHERE id = announcement_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario
COMMENT ON FUNCTION increment_announcement_views IS 'Incrementa el contador de visualizaciones de un anuncio';

