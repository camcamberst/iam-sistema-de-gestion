-- =============================================================
-- Propuesta de RLS para el Módulo "Gestionar Calculadora"
-- NOTA: Todo está COMENTADO para no ejecutar cambios por accidente.
--       Ajustar nombres reales de tablas/roles/columnas antes de aplicar.
--       Requiere confirmar estructura de `users` y `groups`.
-- =============================================================

-- Asunciones (ajustar a tu esquema):
-- - Tabla users(id uuid pk, role text in ('super_admin','admin','modelo'), group_id uuid)
-- - Vista o función que retorna el usuario actual: auth.uid()

-- Habilitar RLS en tablas nuevas (cuando se confirme esquema):
-- ALTER TABLE calc_periods ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE calculator_config ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE model_values ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE calc_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Roles lógicos:
-- - super_admin: acceso total
-- - admin: limitado a modelos de sus grupos y a scope de rates de sus grupos
-- - modelo: solo su propia data y lectura de su config

-- Helper sugerido (función booleana): determina si auth.uid() es super_admin
-- CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean AS $$
--   SELECT EXISTS(
--     SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
--   );
-- $$ LANGUAGE sql STABLE;

-- Helper: determina si auth.uid() es admin del grupo de un modelo dado
-- CREATE OR REPLACE FUNCTION is_admin_of_model(model uuid) RETURNS boolean AS $$
--   SELECT EXISTS(
--     SELECT 1
--     FROM users admin
--     JOIN users model_user ON model_user.id = model
--     WHERE admin.id = auth.uid()
--       AND admin.role = 'admin'
--       AND admin.group_id = model_user.group_id
--   );
-- $$ LANGUAGE sql STABLE;

-- rates
-- Política lectura:
-- Permitir a todos los roles leer tasas globales; y para scope de grupo, solo admins de ese grupo y SA.
-- CREATE POLICY rates_select ON rates FOR SELECT USING (
--   is_super_admin() OR
--   scope = 'global' OR
--   (
--     -- scope con formato 'group:{uuid}'
--     split_part(scope, ':', 1) = 'group' AND
--     EXISTS (
--       SELECT 1 FROM users u
--       WHERE u.id = auth.uid()
--         AND u.role IN ('admin','super_admin')
--         AND u.group_id::text = split_part(scope, ':', 2)
--     )
--   )
-- );

-- Escritura (insert/update/delete): solo SA o admin en su scope
-- CREATE POLICY rates_write ON rates FOR ALL USING (
--   is_super_admin() OR (
--     EXISTS (
--       SELECT 1 FROM users u
--       WHERE u.id = auth.uid()
--         AND u.role = 'admin'
--     )
--   )
-- ) WITH CHECK (
--   is_super_admin() OR (
--     -- Si es admin, solo puede escribir en scope global (si lo permites) o su group
--     scope = concat('group:', (
--       SELECT u.group_id::text FROM users u WHERE u.id = auth.uid()
--     ))
--   )
-- );

-- calculator_config (por modelo)
-- SELECT: SA; admin del grupo del modelo; el propio modelo
-- CREATE POLICY calculator_config_select ON calculator_config FOR SELECT USING (
--   is_super_admin() OR
--   is_admin_of_model(model_id) OR
--   auth.uid() = model_id
-- );

-- INSERT/UPDATE: SA o admin del grupo; el modelo no puede escribir config
-- CREATE POLICY calculator_config_write ON calculator_config FOR INSERT WITH CHECK (
--   is_super_admin() OR is_admin_of_model(model_id)
-- );
-- CREATE POLICY calculator_config_update ON calculator_config FOR UPDATE USING (
--   is_super_admin() OR is_admin_of_model(model_id)
-- ) WITH CHECK (
--   is_super_admin() OR is_admin_of_model(model_id)
-- );

-- model_values (entradas de la modelo por periodo/plataforma)
-- SELECT: SA; admin del grupo; el propio modelo
-- CREATE POLICY model_values_select ON model_values FOR SELECT USING (
--   is_super_admin() OR is_admin_of_model(model_id) OR auth.uid() = model_id
-- );

-- INSERT: modelo (sus datos) y admin/SA para correcciones
-- CREATE POLICY model_values_insert ON model_values FOR INSERT WITH CHECK (
--   is_super_admin() OR is_admin_of_model(model_id) OR auth.uid() = model_id
-- );

-- UPDATE: modelo (sus datos, mismo periodo abierto) y admin/SA
-- (Para limitar a periodo abierto, agregar validación por JOIN a calc_periods o trigger)
-- CREATE POLICY model_values_update ON model_values FOR UPDATE USING (
--   is_super_admin() OR is_admin_of_model(model_id) OR auth.uid() = model_id
-- ) WITH CHECK (
--   is_super_admin() OR is_admin_of_model(model_id) OR auth.uid() = model_id
-- );

-- calc_snapshots: solo lectura; SA y admin del grupo; modelo solo su snapshot
-- CREATE POLICY calc_snapshots_select ON calc_snapshots FOR SELECT USING (
--   is_super_admin() OR
--   is_admin_of_model(model_id) OR
--   auth.uid() = model_id
-- );

-- audit_logs: SA ve todo; admin ve sus grupos; usuario ve sus propias acciones
-- (Se puede filtrar por scope)
-- CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
--   is_super_admin() OR
--   EXISTS (
--     SELECT 1 FROM users u
--     WHERE u.id = auth.uid() AND u.role = 'admin'
--   ) OR actor_id = auth.uid()
-- );

-- notifications: cada usuario ve sus notificaciones; SA puede ver todas si se requiere
-- CREATE POLICY notifications_select ON notifications FOR SELECT USING (
--   is_super_admin() OR user_id = auth.uid()
-- );
-- CREATE POLICY notifications_write ON notifications FOR INSERT WITH CHECK (true);

-- Nota: Considerar funciones SECURE para encapsular lógica sensible, y views para simplificar consumo.

-- =============================================================
-- Fin de propuesta RLS
-- =============================================================


