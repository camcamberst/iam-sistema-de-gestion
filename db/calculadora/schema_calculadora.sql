-- =============================================================
-- Esquema base del Módulo "Gestionar Calculadora" (Borrador seguro)
-- NOTA: Este archivo NO ejecuta cambios automáticamente en la BD.
--       Revísalo y ajústalo antes de aplicar en Supabase.
--       FKs y RLS están comentadas para no comprometer el esquema actual.
-- =============================================================

-- Extensiones (opcional, según entorno)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------
-- Periodos de cálculo naturales (1-15 y 16-fin de mes)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calc_periods (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    start_at            timestamptz NOT NULL,
    end_at              timestamptz NOT NULL,
    timezone            text NOT NULL DEFAULT 'America/Bogota',
    status              text NOT NULL CHECK (status IN ('open','closed')),
    closed_at           timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calc_periods_time_idx ON calc_periods (start_at, end_at);

-- -------------------------------------------------------------
-- Catálogo de plataformas
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platforms (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text UNIQUE NOT NULL,
    name                text NOT NULL,
    conversion_type     text NOT NULL CHECK (
        conversion_type IN ('usd_cop','eur_usd_cop','gbp_usd_cop','tokens')
    ),
    token_rate_usd      numeric(18,6), -- p.ej. 100 tokens -> 5 USD => 0.05 por token
    discount_factor     numeric(10,6), -- p.ej. 0.75, 0.78, 0.677
    tax_factor          numeric(10,6), -- p.ej. 0.84 (para 16% impuesto => 1 - 0.16)
    special_flags       jsonb,         -- p.ej. { "superfoon_100_model": true }
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platforms_code_idx ON platforms (code);

-- -------------------------------------------------------------
-- Tasas de cambio y overrides por alcance
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rates (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id           uuid,          -- referencia a calc_periods cuando es base del periodo
    scope               text NOT NULL, -- 'global' o 'group:{uuid}'
    kind                text NOT NULL CHECK (kind IN ('USD_COP','EUR_USD','GBP_USD')),
    value_raw           numeric(18,6), -- valor original de API o manual
    adjustment          numeric(18,6), -- p.ej. -200 para USD_COP por periodo
    value_effective     numeric(18,6) NOT NULL, -- valor usado tras ajustes/overrides
    source              text NOT NULL, -- 'ECB'|'OXR'|'Fixer'|'manual'|'system'
    author_id           uuid,          -- usuario que realizó el cambio
    valid_from          timestamptz NOT NULL DEFAULT now(),
    valid_to            timestamptz,
    period_base         boolean NOT NULL DEFAULT false, -- tasa base fijada para el periodo
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rates_kind_scope_valid_idx ON rates (kind, scope, valid_from DESC);
CREATE INDEX IF NOT EXISTS rates_period_base_idx ON rates (period_base, period_id);

-- FK sugeridas (comentar/descomentar al mapear tablas reales)
-- ALTER TABLE rates
--   ADD CONSTRAINT rates_period_fk FOREIGN KEY (period_id) REFERENCES calc_periods(id) ON DELETE SET NULL;
-- ALTER TABLE rates
--   ADD CONSTRAINT rates_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

-- -------------------------------------------------------------
-- Configuración de calculadora por modelo (plataformas y overrides)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calculator_config (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id                uuid NOT NULL,
    group_id                uuid,
    enabled_platform_ids    uuid[] NOT NULL DEFAULT '{}',
    porcentaje_override     numeric(5,2),   -- porcentaje de reparto (ej. 80.00)
    cuota_minima_override   numeric(18,2),  -- en USD (TOTAL "DÓLARES")
    version                 integer NOT NULL DEFAULT 1,
    valid_from              timestamptz NOT NULL DEFAULT now(),
    valid_to                timestamptz,
    author_id               uuid,
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calculator_config_model_idx ON calculator_config (model_id, valid_from DESC);

-- FKs sugeridas
-- ALTER TABLE calculator_config
--   ADD CONSTRAINT calculator_config_model_fk FOREIGN KEY (model_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE calculator_config
--   ADD CONSTRAINT calculator_config_group_fk FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
-- ALTER TABLE calculator_config
--   ADD CONSTRAINT calculator_config_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

-- -------------------------------------------------------------
-- Valores ingresados por la modelo (columna "VALORES") por plataforma y periodo
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_values (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id        uuid NOT NULL,
    period_id       uuid NOT NULL,
    platform_id     uuid NOT NULL,
    value_input     numeric(18,6) NOT NULL,
    version         integer NOT NULL DEFAULT 1,
    author_id       uuid, -- modelo o admin que registró/corrigió
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS model_values_unique ON model_values (model_id, period_id, platform_id, version);
CREATE INDEX IF NOT EXISTS model_values_period_idx ON model_values (period_id);

-- FKs sugeridas
-- ALTER TABLE model_values
--   ADD CONSTRAINT model_values_model_fk FOREIGN KEY (model_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE model_values
--   ADD CONSTRAINT model_values_period_fk FOREIGN KEY (period_id) REFERENCES calc_periods(id) ON DELETE CASCADE;
-- ALTER TABLE model_values
--   ADD CONSTRAINT model_values_platform_fk FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE;
-- ALTER TABLE model_values
--   ADD CONSTRAINT model_values_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

-- -------------------------------------------------------------
-- Snapshots al cierre de periodo (congelar tasas aplicadas y totales)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calc_snapshots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id            uuid NOT NULL,
    period_id           uuid NOT NULL,
    totals_json         jsonb NOT NULL,       -- totales calculados (USD/COP, por plataforma, etc.)
    rates_applied_json  jsonb NOT NULL,       -- tasas efectivas aplicadas (incluye overrides)
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS calc_snapshots_unique ON calc_snapshots (model_id, period_id);

-- FKs sugeridas
-- ALTER TABLE calc_snapshots
--   ADD CONSTRAINT calc_snapshots_model_fk FOREIGN KEY (model_id) REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE calc_snapshots
--   ADD CONSTRAINT calc_snapshots_period_fk FOREIGN KEY (period_id) REFERENCES calc_periods(id) ON DELETE CASCADE;

-- -------------------------------------------------------------
-- Auditoría de cambios
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity      text NOT NULL,         -- 'rates'|'calculator_config'|'model_values'|...
    entity_id   uuid NOT NULL,
    field       text,                  -- opcional: campo afectado
    before      jsonb,
    after       jsonb,
    actor_id    uuid,
    scope       text,                  -- alcance: 'global'|'group:{uuid}'|'model:{uuid}'
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity, created_at DESC);

-- -------------------------------------------------------------
-- Notificaciones in-app
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL,
    type        text NOT NULL,         -- 'config_change'|'value_correction'|'quota_alert'|...
    title       text NOT NULL,
    body        text,
    meta        jsonb,
    read_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

-- FKs sugeridas
-- ALTER TABLE notifications
--   ADD CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- =============================================================
-- Fin del borrador de esquema para la calculadora
-- =============================================================


