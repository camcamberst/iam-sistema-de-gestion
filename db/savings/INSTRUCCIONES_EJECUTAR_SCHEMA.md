# 📋 INSTRUCCIONES: Ejecutar Esquema de Ahorros

## ⚠️ PROBLEMA ACTUAL
El error "Could not find the table 'public.model_savings' in the schema cache" indica que las tablas de ahorros no han sido creadas en Supabase.

## ✅ SOLUCIÓN

### Paso 1: Acceder a Supabase SQL Editor
1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral

### Paso 2: Ejecutar el Script
1. Abre el archivo: `db/savings/create_savings_schema.sql`
2. Copia **TODO** el contenido del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **RUN** o presiona `Ctrl+Enter`

### Paso 3: Verificar
Después de ejecutar, deberías ver mensajes de éxito como:
- "Success. No rows returned" (para CREATE TABLE)
- "Success. No rows returned" (para CREATE INDEX)
- "Success. No rows returned" (para CREATE POLICY)

### Paso 4: Verificar Tablas Creadas
Ejecuta esta consulta en el SQL Editor para verificar:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('model_savings', 'savings_withdrawals', 'savings_adjustments', 'savings_goals')
ORDER BY table_name;
```

Deberías ver las 4 tablas listadas.

## 📝 NOTAS IMPORTANTES

- **No ejecutes el script dos veces** - Usa `CREATE TABLE IF NOT EXISTS` así que es seguro, pero las políticas pueden dar error si ya existen
- Si hay errores de políticas duplicadas, puedes ignorarlos o eliminarlos primero
- El script crea:
  - ✅ `model_savings` - Solicitudes de ahorro
  - ✅ `savings_withdrawals` - Retiros
  - ✅ `savings_adjustments` - Ajustes manuales
  - ✅ `savings_goals` - Metas de ahorro
  - ✅ Índices para optimización
  - ✅ Triggers para `updated_at`
  - ✅ Políticas RLS (Row Level Security)

## 🔍 VERIFICACIÓN RÁPIDA

Si quieres verificar rápidamente si las tablas existen:

```sql
-- Verificar si existe model_savings
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'model_savings'
);
```

Si devuelve `false`, necesitas ejecutar el script.
