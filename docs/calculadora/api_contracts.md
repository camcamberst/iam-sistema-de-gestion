## API Calculadora - Contratos (Borrador)

Estado: borrador para revisión. No implementa código ni ejecuta cambios.

### Autenticación y roles
- Requiere sesión. Roles: `super_admin`, `admin`, `modelo`.
- Alcance:
  - `super_admin`: total.
  - `admin`: limitado a modelos de sus grupos.
  - `modelo`: su propia calculadora/valores.

### Periodicidad y cron
- Períodos: 1–15 y 16–fin de mes, timezone America/Bogota.
- Fijado de tasas (period base): 2:00 PM Bogotá los días 1 y 16.
  - Cron: `0 19 1,16 * *` UTC → invoca endpoint protegido.
  - USD→COP efectivo = max(0, API − 200) para todo el período.

---
### Rates

GET /api/rates?scope=global|group:{uuid}&activeOnly=true
- Auth: SA/Admin (Modelo solo lectura global si es necesario)
- Respuesta: lista de tasas vigentes (valor efectivo, fuente, vigencia, period_base)

POST /api/rates
- Auth: SA (global) / Admin (group scope)
- Body: { scope, kind: 'USD_COP'|'EUR_USD'|'GBP_USD', value_raw?, adjustment?, value_effective, source: 'manual' }
- Crea override manual con prioridad.

PATCH /api/rates/{id}
- Auth: SA/Admin según scope
- Body: campos a ajustar (cierra vigencia anterior con valid_to y crea nueva versión o actualiza si es mismo rango)

POST /api/rates/fix-period
- Auth: servicio (cron) + SA manual
- Acciones: consulta ECB/OXR/Fixer, aplica -200 a USD_COP, guarda period_base por `period_id` activo.

---
### Configuración de Calculadora (V2 consolidado)

GET /api/calculator/config-v2?modelId={uuid} | ?userId={uuid}
- Auth: SA/Admin del grupo / Modelo (solo lectura)
- Respuesta: { config: { model_id, active, platforms: [...] } }

POST /api/calculator/config-v2
- Auth: SA/Admin del grupo
- Body: { modelId, adminId, groupId, enabledPlatforms, percentageOverride?, minQuotaOverride?, groupPercentage?, groupMinQuota? }
- Crea/actualiza configuración activa.

---
### Valores de Modelo (columna VALORES)

GET /api/calculator/model-values-v2?modelId={uuid}&periodDate=YYYY-MM-DD
- Auth: SA/Admin del grupo / Modelo
- Respuesta: array por plataforma con { platform_id, value_input, version, created_at }

POST /api/calculator/model-values-v2
- Auth: Modelo (propios) / SA/Admin (corrección)
- Body: { model_id, period_id, items: [{ platform_id, value_input }] }
- Crea nueva versión o upsert según política.

---
### Preview de cálculo y cierre de período

GET /api/calculator/preview?model_id={uuid}&period_id={uuid}
- Auth: SA/Admin del grupo / Modelo
- Respuesta: totales USD/COP por plataforma, TOTAL “DÓLARES”, COP MODELO, alertas (cuota mínima), anticipo max (90%).

POST /api/calculator/close-period
- Auth: SA/Admin
- Body: { period_id }
- Acciones: recalcula con rates efectivas, genera `calc_snapshots` y bloquea edición del período.

---
### Auditoría y notificaciones

GET /api/audit?entity=rates|calculator_config|model_values&entity_id={uuid}
- Auth: SA/Admin; usuario ve sus propias acciones.

GET /api/notifications
- Auth: usuario
- Respuesta: notificaciones in-app (cambios de config, correcciones, alertas cuota mínima).

---
### Notas de implementación
- Todas las fechas en UTC en la API; conversión a timezone en UI.
- Validaciones numéricas: evitar negativos; COP sin decimales; USD 2 decimales.
- Seguridad: RLS + validación extra en endpoint.
- Idempotencia: endpoints de cron deben ser idempotentes por `period_id`.


