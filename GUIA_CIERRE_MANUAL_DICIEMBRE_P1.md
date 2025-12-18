# 🔄 GUÍA: Cerrar Manualmente el Período P1 Diciembre 2025

## 📋 Situación Actual

El período 1-15 de diciembre 2025 **no se cerró automáticamente** y no hay registros en `calculator_history`. Necesitamos cerrarlo manualmente.

---

## 🔍 PASO 1: Diagnóstico

Ejecuta este SQL en Supabase para verificar el estado:

```sql
-- Ver estado de cierre
SELECT 
  period_date,
  period_type,
  status,
  started_at,
  completed_at,
  error_message
FROM calculator_period_closure_status
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-31'
  AND period_type = '1-15'
ORDER BY started_at DESC
LIMIT 5;

-- Ver si hay datos en model_values (deberían estar vacíos si se cerró)
SELECT 
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as modelos_con_valores
FROM model_values
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-15';

-- Ver si hay datos en calculator_totals
SELECT 
  COUNT(*) as total_registros
FROM calculator_totals
WHERE period_type = '1-15'
  AND period_date >= '2025-12-01'
  AND period_date <= '2025-12-31';
```

---

## 🔧 PASO 2: Cerrar el Período Manualmente

### Opción A: Usando el Script Node.js (Recomendado)

1. **Asegúrate de tener `CRON_SECRET_KEY` en `.env.local`**

2. **Ejecuta el script:**
```bash
node scripts/close-december-p1-manually.js
```

### Opción B: Usando cURL desde Terminal

```bash
curl -X POST "https://iam-sistema-de-gestion.vercel.app/api/calculator/period-closure/close-period" \
  -H "Content-Type: application/json" \
  -H "x-force-period-date: 2025-12-01" \
  -H "x-force-period-type: 1-15" \
  -H "x-force-close-secret: [TU_CRON_SECRET_KEY]" \
  -H "x-testing-mode: true"
```

### Opción C: Desde el Navegador (Consola del Desarrollador)

Si estás autenticado como super_admin:

```javascript
const token = (await supabase.auth.getSession()).data.session?.access_token;

const response = await fetch('/api/calculator/period-closure/close-period', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-force-period-date': '2025-12-01',
    'x-force-period-type': '1-15',
    'x-testing-mode': 'true'
  }
});

const data = await response.json();
console.log(data);
```

---

## ✅ PASO 3: Verificar que se Cerró Correctamente

Ejecuta este SQL después del cierre:

```sql
-- Verificar registros archivados
SELECT 
  period_date,
  period_type,
  COUNT(*) as total_registros,
  COUNT(archived_at) as con_archived_at
FROM calculator_history
WHERE period_date = '2025-12-01'
  AND period_type = '1-15'
GROUP BY period_date, period_type;

-- Verificar estado de cierre
SELECT 
  period_date,
  period_type,
  status,
  completed_at
FROM calculator_period_closure_status
WHERE period_date = '2025-12-01'
  AND period_type = '1-15'
ORDER BY created_at DESC
LIMIT 1;
```

**Resultado esperado:**
- `calculator_history` debe tener registros con `archived_at` no nulo
- `calculator_period_closure_status` debe tener status `completed`

---

## ⚠️ NOTAS IMPORTANTES

1. **El script usa `x-testing-mode: true`** para reducir tiempos de espera (2.5 minutos → 5 segundos)

2. **Si hay datos en `model_values`**, el cierre los archivará automáticamente

3. **Si NO hay datos en `model_values`**, el cierre se completará pero no habrá nada que archivar (esto es normal si el período no tuvo actividad)

4. **Después del cierre**, podrás editar las rates históricas desde la página de Stats del Gestor

---

## 🆘 Si el Cierre Falla

Si el cierre falla, revisa los logs del endpoint. Los errores comunes son:

- **"No es día de cierre"**: El endpoint detecta que no es día 1 o 16. Usa `x-force-period-date` para forzar
- **"Período ya fue cerrado"**: Ya existe un registro con status `completed`. Puedes forzar con `x-force-close-secret
- **Error de base de datos**: Revisa los logs del servidor para más detalles

