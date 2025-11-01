# 📋 Plan de Implementación: Nuevo Sistema de Cierre de Períodos

## 🎯 Objetivo

Implementar un sistema de cierre de períodos de facturación con:
- Dos momentos de congelación (medianoche Europa Central y 00:00 Colombia)
- 10 plataformas especiales con cierre anticipado
- Actualización en tiempo real sin recargar página
- Integración con AIM Botty para notificaciones
- Sistema robusto con estados y recuperación ante fallos

---

## 📦 Componentes a Implementar

### 1. **Base de Datos**

#### Tabla: `calculator_period_closure_status`
Para rastrear el estado del proceso de cierre:
```sql
CREATE TABLE calculator_period_closure_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('1-15', '16-31')),
  status text NOT NULL CHECK (status IN (
    'pending', 
    'early_freezing', 
    'closing_calculators',
    'waiting_summary',
    'closing_summary',
    'archiving',
    'completed',
    'failed'
  )),
  current_step integer DEFAULT 0,
  total_steps integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### Tabla: `calculator_early_frozen_platforms`
Para rastrear plataformas congeladas anticipadamente:
```sql
CREATE TABLE calculator_early_frozen_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date date NOT NULL,
  model_id uuid NOT NULL REFERENCES users(id),
  platform_id text NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_date, model_id, platform_id)
);
```

#### Actualizar: `calculator_history`
Asegurar que tenga todos los campos necesarios para el nuevo sistema.

---

### 2. **Utilidades de Timezone**

#### Archivo: `utils/period-closure-dates.ts`
- `getEuropeanCentralMidnightInColombia()`: Calcula medianoche Europa Central en hora Colombia
- `getColombiaMidnight()`: Obtiene 00:00 Colombia
- `isEarlyFreezeTime()`: Verifica si es momento de congelar plataformas especiales
- `isFullClosureTime()`: Verifica si es momento de cierre completo
- `getPlatformsForEarlyFreeze()`: Lista las 10 plataformas especiales

---

### 3. **Estados de Cierre**

#### Archivo: `lib/calculator/period-closure-states.ts`
Definir estados y transiciones válidas:
```typescript
export type ClosureStatus = 
  | 'pending'
  | 'early_freezing'
  | 'closing_calculators'
  | 'waiting_summary'
  | 'closing_summary'
  | 'archiving'
  | 'completed'
  | 'failed';

export const VALID_TRANSITIONS = {
  pending: ['early_freezing', 'closing_calculators', 'failed'],
  early_freezing: ['closing_calculators', 'failed'],
  closing_calculators: ['waiting_summary', 'failed'],
  waiting_summary: ['closing_summary', 'failed'],
  closing_summary: ['archiving', 'failed'],
  archiving: ['completed', 'failed'],
  completed: [],
  failed: ['pending'] // Solo para retry manual
};
```

---

### 4. **API Endpoints**

#### `/api/calculator/period-closure/check-status`
**GET**: Verifica estado actual del cierre de período
- Retorna estado actual
- Útil para polling o verificación

#### `/api/calculator/period-closure/early-freeze`
**POST**: Congela las 10 plataformas especiales (medianoche Europa Central)
- Verifica que sea el momento correcto
- Congela plataformas especiales para todos los modelos
- Actualiza estado a `early_freezing`
- Emite evento Supabase Realtime

#### `/api/calculator/period-closure/close-period`
**POST**: Cierra período completo (00:00 Colombia)
- Verifica que todas las calculadoras estén listas
- Archiva todas las calculadoras
- Espera confirmación de "Resumen de Facturación"
- Cierra resumen
- Resetea calculadoras
- Actualiza estados
- Emite eventos Realtime

#### `/api/calculator/period-closure/manual-close`
**POST**: Cierre manual para casos de recuperación
- Permite retomar desde último paso exitoso
- Solo para admins/super_admins

#### `/api/calculator/platform-freeze-status`
**GET**: Obtiene estado de congelación de plataformas por modelo
- Retorna qué plataformas están congeladas
- Útil para UI reactiva

---

### 5. **Supabase Realtime**

#### Canales a Suscribir:
- `calculator_period_closure_status`: Cambios en estado de cierre
- `calculator_early_frozen_platforms`: Plataformas congeladas
- `calculator_history`: Nuevos períodos archivados

#### Eventos a Emitir:
- `period_closing_started`: Cierre iniciado
- `early_freeze_completed`: Congelación anticipada completada
- `calculators_closed`: Todas las calculadoras cerradas
- `summary_closed`: Resumen cerrado
- `period_archived`: Período archivado
- `period_reset`: Nuevo período iniciado

---

### 6. **Integración con AIM Botty**

#### Archivo: `lib/chat/period-closure-notifications.ts`
Notificaciones automáticas:
- Para modelos: "Las plataformas especiales se han congelado"
- Para modelos: "El período ha cerrado. Tus valores están siendo archivados..."
- Para modelos: "Nuevo período iniciado. Puedes comenzar a ingresar valores"
- Para admin: "Período cerrado exitosamente. Disponible en Consulta Histórica"
- Para admin: "Error en cierre de período. Revisar logs"

---

### 7. **UI Reactiva**

#### Componente: `components/calculator/PeriodClosureIndicator.tsx`
- Muestra estado del cierre en tiempo real
- Badge "Período cerrado" en plataformas congeladas
- Mensajes de progreso
- Integración con Supabase Realtime

#### Hook: `hooks/usePeriodClosureStatus.ts`
- Suscripción a cambios de estado
- Estado local reactivo
- Auto-actualización

#### Componente: `components/calculator/PlatformStatusBadge.tsx`
- Badge visual para plataformas congeladas
- Estado disabled en campos
- Tooltip explicativo

---

### 8. **Cron Jobs**

#### Actualizar `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-chat",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/period-closure-early-freeze",
      "schedule": "0 5 1,16 * *"
    },
    {
      "path": "/api/cron/period-closure-full-close",
      "schedule": "0 5 1,16 * *"
    }
  ]
}
```

**Nota**: Los schedules se ejecutarán a las 05:00 UTC = 00:00 Colombia
- Primero se ejecuta early-freeze (debe calcular hora Europa Central)
- Luego se ejecuta full-close (00:00 Colombia)

---

### 9. **Desactivar Sistema Anterior**

#### Archivos a Desactivar/Mover:
- `app/api/calculator/auto-close-period/route.ts` → Comentar/Deprecar
- `app/api/cron/auto-close-calculator/route.ts` → Reemplazar con nuevos
- Scripts antiguos → Mover a carpeta `scripts/deprecated/`

#### Verificar NO afectar:
- `utils/anticipo-restrictions.ts` ✅ NO TOCAR
- Períodos de anticipos ✅ NO TOCAR
- `calculator_history` ✅ Reutilizar (solo ampliar campos si necesario)

---

### 10. **Plataformas Especiales**

Lista de 10 plataformas que se congelan a medianoche Europa Central:
```typescript
export const EARLY_FREEZE_PLATFORMS = [
  'superfoon',
  'livecreator',
  'mdh',
  '777',
  'xmodels',
  'big7',
  'mondo',
  'vx',
  'babestation',
  'dirtyfans'
];
```

---

## 🔄 Flujo Completo

### Fase 1: Congelación Anticipada (Medianoche Europa Central)
1. Cron detecta medianoche Europa Central en hora Colombia
2. Ejecuta `/api/cron/period-closure-early-freeze`
3. Actualiza estado a `early_freezing`
4. Para cada modelo activo:
   - Marca 10 plataformas especiales como congeladas
   - Inserta en `calculator_early_frozen_platforms`
   - Emite evento Realtime
5. Actualiza estado a `closing_calculators`
6. Notifica a modelos vía AIM Botty

### Fase 2: Cierre Completo (00:00 Colombia)
1. Cron detecta 00:00 Colombia
2. Ejecuta `/api/cron/period-closure-full-close`
3. Auto-guarda últimos valores pendientes
4. Para cada modelo activo:
   - Archiva valores a `calculator_history`
   - Resetea `model_values` del período
5. Espera 2 minutos + tiempo de polling del resumen
6. Cierra "Resumen de Facturación"
7. Archiva resumen a "Consulta Histórica"
8. Resetea calculadoras a 0.00
9. Actualiza estado a `completed`
10. Notifica a modelos y admin vía AIM Botty

---

## 📝 Checklist de Implementación

### Fase 1: Preparación
- [ ] Crear tablas en base de datos
- [ ] Crear utilidades de timezone
- [ ] Definir estados y transiciones
- [ ] Lista de 10 plataformas especiales

### Fase 2: Backend
- [ ] Endpoint: `/api/calculator/period-closure/check-status`
- [ ] Endpoint: `/api/calculator/period-closure/early-freeze`
- [ ] Endpoint: `/api/calculator/period-closure/close-period`
- [ ] Endpoint: `/api/calculator/period-closure/manual-close`
- [ ] Endpoint: `/api/calculator/platform-freeze-status`
- [ ] Cron: `/api/cron/period-closure-early-freeze`
- [ ] Cron: `/api/cron/period-closure-full-close`

### Fase 3: Integración
- [ ] Supabase Realtime: Canales y eventos
- [ ] AIM Botty: Notificaciones
- [ ] Integración con "Resumen de Facturación"

### Fase 4: Frontend
- [ ] Hook: `usePeriodClosureStatus`
- [ ] Componente: `PeriodClosureIndicator`
- [ ] Componente: `PlatformStatusBadge`
- [ ] Integración en "Mi Calculadora"

### Fase 5: Desactivación
- [ ] Desactivar sistema antiguo
- [ ] Actualizar `vercel.json`
- [ ] Documentación
- [ ] Testing completo

---

## 🧪 Testing

### Casos de Prueba:
1. Congelación anticipada en medianoche Europa Central
2. Cierre completo en 00:00 Colombia
3. Recuperación ante fallo
4. Notificaciones AIM Botty
5. UI reactiva sin recargar
6. Integración con Resumen de Facturación
7. Verificar NO afectar períodos de anticipos

---

## 📚 Documentación

- [ ] Actualizar `docs/calculadora/flows.md`
- [ ] Crear `docs/period-closure-system.md`
- [ ] Actualizar README si necesario

