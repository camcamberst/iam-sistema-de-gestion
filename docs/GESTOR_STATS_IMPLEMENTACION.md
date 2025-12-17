# 📊 IMPLEMENTACIÓN: Planilla de Stats del Gestor

## 🎯 Objetivo

Implementar un sistema de planilla de Stats donde el gestor puede ingresar valores oficiales en bruto de cada modelo y cada plataforma, independiente de "Mi Calculadora" y otras funciones del sistema.

## 📋 Características Implementadas

### 1. **Tabla de Base de Datos: `gestor_stats_values`**

- **Ubicación:** `db/gestor/create_gestor_stats_values_table.sql`
- **Propósito:** Almacenar valores oficiales en bruto ingresados por el gestor
- **Estructura:**
  - `model_id`: ID del modelo
  - `group_id`: ID del grupo/sede al que pertenece el modelo
  - `platform_id`: ID de la plataforma
  - `period_date`: Fecha de inicio del período (1 o 16 del mes)
  - `period_type`: Tipo de período ('1-15' o '16-31')
  - `value`: Valor oficial en bruto (en la moneda de la plataforma)
  - `registrado_por`: ID del gestor que registró el valor
  - `created_at` / `updated_at`: Timestamps

- **Constraints:**
  - UNIQUE: `(model_id, platform_id, period_date, period_type)` - Un modelo solo puede tener un valor por plataforma y período
  - RLS habilitado con políticas para gestores, admins y modelos

### 2. **Generación Automática de Planilla**

#### Endpoint: `/api/gestor/stats/generate-sheet`

- **POST:** Genera automáticamente la planilla para un período específico
  - Crea registros vacíos (valor 0) para cada modelo activo y cada plataforma activa
  - Agrupa por grupo/sede automáticamente
  - Solo crea registros que no existen (evita duplicados)

- **GET:** Verifica el estado de la planilla para un período específico

#### Cron Job: `/api/cron/gestor-generate-stats-sheet`

- **Schedule:** `0 5 1,16 * *` (días 1 y 16 a las 00:05 hora Colombia)
- **Funcionalidad:**
  - Se ejecuta automáticamente cuando inicia un nuevo período
  - Verifica si ya existe la planilla antes de generarla
  - Llama al endpoint de generación para crear la planilla

### 3. **Guardado de Valores**

#### Endpoint: `/api/gestor/stats/save-value`

- **POST:** Guarda o actualiza un valor oficial en bruto
  - Valida que el usuario sea gestor, admin o super_admin
  - Valida que el modelo pertenezca al grupo especificado
  - Usa UPSERT para insertar o actualizar según corresponda

### 4. **Interfaz de Usuario**

#### Página: `app/gestor/gestion-agencia/stats/page.tsx`

- **Estructura similar al Excel:**
  - Modelos en filas
  - Plataformas en columnas
  - Cada plataforma tiene dos columnas: P1 y P2
  - Columnas fijas: Clave y Usuario

- **Funcionalidades:**
  - Selección de grupo/sede
  - Selección de año y mes
  - Carga automática de modelos del grupo seleccionado
  - Carga automática de plataformas activas
  - Edición inline de valores (clic en celda)
  - Guardado automático al hacer blur o presionar Enter
  - Carga de valores existentes desde `gestor_stats_values`

## 🔄 Flujo de Trabajo

### 1. **Generación Automática (Inicio de Período)**

```
Día 1 o 16 a las 00:05 Colombia
    ↓
Cron Job se ejecuta
    ↓
Verifica si existe planilla
    ↓
Si no existe:
    - Obtiene todos los grupos activos
    - Para cada grupo:
        - Obtiene modelos activos del grupo
        - Para cada modelo y plataforma:
            - Crea registro vacío (valor 0) en gestor_stats_values
```

### 2. **Ingreso de Valores (Durante el Período)**

```
Gestor accede a Stats
    ↓
Selecciona grupo/sede
    ↓
Selecciona año y mes
    ↓
Sistema carga:
    - Modelos del grupo
    - Plataformas activas
    - Valores existentes (P1 y P2)
    ↓
Gestor hace clic en celda
    ↓
Ingresa valor
    ↓
Al guardar (blur o Enter):
    - Valida permisos
    - Valida que modelo pertenezca al grupo
    - Guarda en gestor_stats_values
    - Actualiza interfaz
```

## 📊 Estructura de Datos

### Ejemplo de Registro en `gestor_stats_values`:

```json
{
  "id": "uuid",
  "model_id": "uuid-del-modelo",
  "group_id": "uuid-del-grupo",
  "platform_id": "chaturbate",
  "period_date": "2025-01-01",
  "period_type": "1-15",
  "value": 1500.50,
  "registrado_por": "uuid-del-gestor",
  "created_at": "2025-01-01T00:05:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

## 🔐 Seguridad

### Políticas RLS:

1. **Gestores:** Pueden leer y escribir todos los registros
2. **Admins y Super_Admins:** Pueden leer y escribir todos los registros
3. **Modelos:** Solo pueden leer sus propios registros (solo lectura)

### Validaciones:

- El usuario debe ser gestor, admin o super_admin para guardar valores
- El modelo debe pertenecer al grupo especificado
- El valor debe ser numérico
- No se pueden crear duplicados (UNIQUE constraint)

## 🚀 Configuración

### 1. **Crear la Tabla en Supabase:**

Ejecutar el script SQL:
```bash
db/gestor/create_gestor_stats_values_table.sql
```

### 2. **Configurar Cron Job en Vercel:**

Ya está configurado en `vercel.json`:
```json
{
  "path": "/api/cron/gestor-generate-stats-sheet",
  "schedule": "0 5 1,16 * *"
}
```

### 3. **Variables de Entorno Requeridas:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET_KEY` (opcional pero recomendado)

## 📝 Notas Importantes

1. **Independiente de "Mi Calculadora":**
   - Los valores en `gestor_stats_values` son independientes de `model_values`
   - No afecta el funcionamiento de la calculadora de modelos
   - No se sincroniza automáticamente

2. **Generación Automática:**
   - La planilla se genera automáticamente al inicio de cada período
   - Si el gestor necesita generar manualmente, puede llamar al endpoint POST `/api/gestor/stats/generate-sheet`

3. **Valores en Bruto:**
   - Los valores se almacenan tal como los ingresa el gestor
   - No se aplican conversiones de moneda ni cálculos
   - Se almacenan en la moneda original de la plataforma

4. **Agrupación por Grupo/Sede:**
   - El sistema identifica automáticamente el grupo al que pertenece cada modelo
   - La planilla se muestra agrupada por grupo/sede
   - Los valores se guardan con el `group_id` correspondiente

## 🔄 Próximos Pasos (Futuras Mejoras)

1. **Cálculos Financieros:**
   - ADELANTOS (Totales, Mes, P1, P2)
   - PAGOS (Q1, Q2)
   - SHOP (Q1, Q2)
   - PUNTAJE

2. **Resultados Finales:**
   - PROFIT MODELO
   - PROFIT AGENCIA
   - PAGO FINAL MODELO

3. **Totales Generales:**
   - TOTAL WEB
   - Resumen financiero por grupo/sede

4. **Auditoría:**
   - Sistema de auditoría para validar valores ingresados
   - Notificaciones a administradores

5. **Exportación:**
   - Exportar planilla a Excel
   - Exportar planilla a PDF

## 📚 Archivos Creados/Modificados

### Nuevos Archivos:
- `db/gestor/create_gestor_stats_values_table.sql`
- `app/api/gestor/stats/generate-sheet/route.ts`
- `app/api/gestor/stats/save-value/route.ts`
- `app/api/cron/gestor-generate-stats-sheet/route.ts`
- `docs/GESTOR_STATS_IMPLEMENTACION.md`

### Archivos Modificados:
- `app/gestor/gestion-agencia/stats/page.tsx`
- `vercel.json`

