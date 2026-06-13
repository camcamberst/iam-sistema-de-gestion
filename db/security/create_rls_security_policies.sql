-- =============================================================
-- 🔐 SEGURIDAD: CONTROL DE ACCESO A NIVEL DE FILA (RLS)
-- Ecosistema: Aurora (iam-gestion)
-- Objetivo: Blindar las 10 tablas críticas reportadas
-- =============================================================

-- 1. HABILITACIÓN DE RLS (ROW LEVEL SECURITY)
-- =============================================================
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.operating_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calc_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.calculator_history_2026_03_p1_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_broadcast_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcement_admin_targets ENABLE ROW LEVEL SECURITY;

-- 2. LIMPIEZA DE POLÍTICAS PREVIAS (Para evitar duplicados)
-- =============================================================
DROP POLICY IF EXISTS "Admins can manage sales" ON public.sales;
DROP POLICY IF EXISTS "Models can view their own sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can manage operating costs" ON public.operating_costs;
DROP POLICY IF EXISTS "Admins can manage cash movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Public select products" ON public.products;
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
DROP POLICY IF EXISTS "Admins manage periods" ON public.calc_periods;
DROP POLICY IF EXISTS "Models view active periods" ON public.calc_periods;
DROP POLICY IF EXISTS "Admins manage snapshots" ON public.calc_snapshots;
DROP POLICY IF EXISTS "Models view own snapshots" ON public.calc_snapshots;
DROP POLICY IF EXISTS "Admins manage history backup" ON public.calculator_history_2026_03_p1_backup;
DROP POLICY IF EXISTS "Admins manage broadcasts" ON public.chat_broadcasts;
DROP POLICY IF EXISTS "Models select broadcasts" ON public.chat_broadcasts;
DROP POLICY IF EXISTS "Admins manage broadcast targets" ON public.chat_broadcast_targets;
DROP POLICY IF EXISTS "Models select broadcast targets" ON public.chat_broadcast_targets;
DROP POLICY IF EXISTS "Admins manage announcement targets" ON public.announcement_admin_targets;
DROP POLICY IF EXISTS "Models select announcement targets" ON public.announcement_admin_targets;

-- 3. CREACIÓN DE POLÍTICAS DE ACCESO
-- =============================================================

-- -------------------------------------------------------------
-- TABLA: sales (Ventas)
-- -------------------------------------------------------------
-- Admins y Super Admins: Gestión total
CREATE POLICY "Admins can manage sales" ON public.sales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Modelos: Solo lectura de sus propias ventas asociadas a su perfil
CREATE POLICY "Models can view their own sales" ON public.sales
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.model_profiles mp
      WHERE mp.id = public.sales.model_id AND mp.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- TABLA: operating_costs (Costos Operativos)
-- -------------------------------------------------------------
-- Exclusivo para administradores (Bloqueo absoluto para modelos)
CREATE POLICY "Admins can manage operating costs" ON public.operating_costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- -------------------------------------------------------------
-- TABLA: cash_movements (Movimientos de Caja)
-- -------------------------------------------------------------
-- Exclusivo para administradores (Bloqueo absoluto para modelos)
CREATE POLICY "Admins can manage cash movements" ON public.cash_movements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- -------------------------------------------------------------
-- TABLA: products (Productos)
-- -------------------------------------------------------------
-- Cualquier usuario autenticado puede ver el catálogo de productos
CREATE POLICY "Public select products" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admins y Super Admins: Agregar, actualizar o borrar productos
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- -------------------------------------------------------------
-- TABLA: calc_periods (Periodos de Liquidación)
-- -------------------------------------------------------------
-- Cualquier usuario puede ver los periodos (para saber cuál está activo)
CREATE POLICY "Models view active periods" ON public.calc_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo administradores pueden crear, cerrar o abrir periodos
CREATE POLICY "Admins manage periods" ON public.calc_periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- -------------------------------------------------------------
-- TABLA: calc_snapshots (Historial y Copia de Cuenta)
-- -------------------------------------------------------------
-- Admins pueden gestionar y ver todos los snapshots
CREATE POLICY "Admins manage snapshots" ON public.calc_snapshots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Modelos pueden consultar únicamente su propio snapshot de ganancias
CREATE POLICY "Models view own snapshots" ON public.calc_snapshots
  FOR SELECT USING (model_id = auth.uid());

-- -------------------------------------------------------------
-- TABLA: calculator_history_2026_03_p1_backup (Copia de Seguridad Histórica)
-- -------------------------------------------------------------
-- Exclusivo para administradores
CREATE POLICY "Admins manage history backup" ON public.calculator_history_2026_03_p1_backup
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- -------------------------------------------------------------
-- TABLA: chat_broadcasts (Mensajes de Difusión)
-- -------------------------------------------------------------
-- Admins y Super Admins: Gestión total
CREATE POLICY "Admins manage broadcasts" ON public.chat_broadcasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Modelos: Solo pueden ver los mensajes de difusión si son destinatarios de la misma
CREATE POLICY "Models select broadcasts" ON public.chat_broadcasts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_broadcast_targets cbt
      WHERE cbt.broadcast_id = public.chat_broadcasts.id AND cbt.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- TABLA: chat_broadcast_targets (Destinatarios de Difusión)
-- -------------------------------------------------------------
-- Admins: Gestión total
CREATE POLICY "Admins manage broadcast targets" ON public.chat_broadcast_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Usuarios: Ver si son parte del listado de envío
CREATE POLICY "Models select broadcast targets" ON public.chat_broadcast_targets
  FOR SELECT USING (user_id = auth.uid());

-- -------------------------------------------------------------
-- TABLA: announcement_admin_targets (Destinatarios de Anuncios)
-- -------------------------------------------------------------
-- Admins: Gestión total
CREATE POLICY "Admins manage announcement targets" ON public.announcement_admin_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Usuarios: Ver únicamente sus metas asignadas de anuncios
CREATE POLICY "Models select announcement targets" ON public.announcement_admin_targets
  FOR SELECT USING (user_id = auth.uid());
