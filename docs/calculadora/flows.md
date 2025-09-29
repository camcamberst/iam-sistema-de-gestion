## Flujos críticos - Calculadora

### Fijado de tasas (días 1 y 16 a las 2:00 PM Bogotá)
1. Cron invoca endpoint protegido `/api/rates/fix-period`.
2. Servicio consulta proveedores (ECB/OXR/Fixer) y obtiene:
   - EUR→USD (ECB)
   - GBP→USD (OXR/Fixer)
   - USD→COP (OXR/Fixer)
3. Aplica ajuste: USD→COP_effective = max(0, USD→COP_raw − 200).
4. Guarda en `rates` como `period_base=true`, vinculando `period_id` abierto.
5. Si existen overrides vigentes, estos tienen prioridad en cálculos.

### Preview de cálculo (Admin/Modelo)
1. Cliente llama `GET /api/calculator/preview?model_id&period_id`.
2. API obtiene config del modelo (plataformas habilitadas, overrides), valores del período y tasas efectivas.
3. Aplica reglas por plataforma (EUR/GBP/tokens/discounts), reparto, cuota mínima y anticipo 90% COP.
4. Devuelve totales por plataforma y globales, alertas y capacidad de anticipo.

### Cierre de período
1. SA/Admin invoca `POST /api/calculator/close-period`.
2. Endpoint recalcula, crea `calc_snapshots` (totales + rates aplicadas), marca período `closed`.
3. Modelos ya no pueden editar `model_values` del período cerrado.


