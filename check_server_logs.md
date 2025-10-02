# 🔍 VERIFICAR LOGS DEL SERVIDOR

## 📋 PASOS PARA DIAGNOSTICAR EL PROBLEMA:

### 1. **EJECUTAR SCRIPT DE DEBUG:**
```bash
# 1. Ir a "Ver Calculadora de Modelo" en el navegador
# 2. Abrir consola del navegador (F12)
# 3. Copiar y pegar el contenido de debug_save_issue.js
# 4. Ejecutar y ver los resultados
```

### 2. **VERIFICAR LOGS DEL SERVIDOR:**
```bash
# En Vercel Dashboard o logs del servidor, buscar:
# - "🔍 [MODEL-VALUES-V2] Saving values:"
# - "🔍 [MODEL-VALUES-V2] Query completed. Values:"
# - "❌ [MODEL-VALUES-V2] Database error:"
```

### 3. **VERIFICAR BASE DE DATOS:**
```sql
-- Ejecutar en Supabase SQL Editor:
-- (Reemplazar 'TU_MODEL_ID' con el ID real de la modelo)

-- Verificar si hay datos
SELECT * FROM public.model_values 
WHERE model_id = 'TU_MODEL_ID' 
ORDER BY updated_at DESC 
LIMIT 10;

-- Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'model_values' 
AND table_schema = 'public';
```

### 4. **PROBAR API DIRECTAMENTE:**
```bash
# Usar curl o Postman para probar la API directamente:

# GET (cargar datos)
curl "https://tu-dominio.com/api/calculator/model-values-v2?modelId=TU_MODEL_ID&periodDate=2025-01-20"

# POST (guardar datos)
curl -X POST "https://tu-dominio.com/api/calculator/model-values-v2" \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "TU_MODEL_ID",
    "values": {"777": 10.50, "big7": 25.00},
    "periodDate": "2025-01-20"
  }'
```

## 🎯 POSIBLES CAUSAS DEL PROBLEMA:

### **A. PROBLEMA DE FECHAS:**
- `periodDate` no coincide entre guardado y carga
- Diferencia de timezone entre cliente y servidor
- Fecha se está calculando incorrectamente

### **B. PROBLEMA DE IDs:**
- `modelId` no es el correcto
- Conflicto entre ID del admin y ID de la modelo
- RLS (Row Level Security) bloqueando el acceso

### **C. PROBLEMA DE BASE DE DATOS:**
- Tabla `model_values` no existe o tiene estructura incorrecta
- Constraints o índices causando problemas
- Permisos de Supabase incorrectos

### **D. PROBLEMA DE API:**
- Error en la función `upsert`
- Problema con `SUPABASE_SERVICE_ROLE_KEY`
- Error en el parsing de datos

## 🔍 PRÓXIMOS PASOS:

1. **Ejecutar el script de debug**
2. **Verificar logs del servidor**
3. **Revisar la base de datos directamente**
4. **Probar la API con herramientas externas**
5. **Identificar la causa raíz específica**
