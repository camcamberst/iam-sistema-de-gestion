# 🕐 CONFIGURACIÓN DE CRON JOB PARA CORTES AUTOMÁTICOS

## 📋 INSTRUCCIONES DE CONFIGURACIÓN

### **1. VERCEL CRON JOBS (Recomendado)**

Agregar al archivo `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-close-calculator",
      "schedule": "0 0 1,16 * *"
    }
  ]
}
```

**Explicación del schedule:**
- `0 17 15,30 * *` = A las 17:00 (5:00 PM) los días 15 y 30 de cada mes
- Usa huso horario de Colombia (America/Bogota) sincronizado con medianoche europea
- Detección automática de horario de verano/invierno europeo

### **2. ALTERNATIVA: CRON EXTERNO**

Si no usas Vercel, configurar cron en servidor:

```bash
# Editar crontab
crontab -e

# Agregar línea:
0 0 1,16 * * curl -X GET "https://tu-dominio.com/api/cron/auto-close-calculator"
```

### **3. VARIABLES DE ENTORNO REQUERIDAS**

```env
# URL de la aplicación
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# Clave secreta para cron (opcional pero recomendado)
CRON_SECRET_KEY=tu-clave-secreta-aqui
```

### **4. TESTING MANUAL**

Para probar el sistema manualmente:

```bash
# GET: Verificar si es día de corte
curl -X GET "https://tu-dominio.com/api/cron/auto-close-calculator"

# POST: Ejecutar cierre manual (para testing)
curl -X POST "https://tu-dominio.com/api/cron/auto-close-calculator"
```

### **5. MONITOREO**

El sistema registra logs detallados:

```bash
# Verificar logs en Vercel
vercel logs --follow

# O en servidor
tail -f /var/log/cron.log
```

## 🔄 FLUJO DE FUNCIONAMIENTO

1. **Día 1 o 16 a las 00:00 Europa Central**
2. **Cron job se ejecuta automáticamente**
3. **Sistema verifica si es día de corte**
4. **Si es día de corte:**
   - Obtiene todas las configuraciones activas
   - Para cada modelo:
     - Archiva valores actuales en `calculator_history`
     - Elimina valores actuales (reset calculadora)
5. **Modelos ven calculadora en ceros**
6. **Modelos pueden ver historial en "Mi Historial"**

## 📊 ESTRUCTURA DE DATOS

### **Tabla `calculator_history`:**
```sql
- id: UUID (PK)
- model_id: UUID (FK a users)
- platform_id: TEXT
- value: DECIMAL(10,2)
- period_date: DATE
- period_type: '1-15' | '16-31'
- archived_at: TIMESTAMP
- original_updated_at: TIMESTAMP
```

### **Respuesta del API:**
```json
{
  "success": true,
  "message": "Cierre automático completado",
  "period": "Período 1 (días 1-15)",
  "date": "2024-01-01",
  "results": [
    {
      "model_id": "uuid",
      "status": "success",
      "values_archived": 5
    }
  ],
  "summary": {
    "total_models": 10,
    "successful": 10,
    "failed": 0
  }
}
```

## 🚨 CONSIDERACIONES IMPORTANTES

1. **Huso Horario:** El sistema usa Europa Central para cortes
2. **Backup:** Los valores se archivan antes de eliminar
3. **Recuperación:** No se puede recuperar valores eliminados
4. **Monitoreo:** Revisar logs después de cada corte
5. **Testing:** Probar en ambiente de desarrollo primero

## 🔧 TROUBLESHOOTING

### **Error: "No es día de corte"**
- Verificar que el cron se ejecute en días 1 y 16
- Verificar huso horario del servidor

### **Error: "Error en cierre automático"**
- Verificar que la tabla `calculator_history` exista
- Verificar permisos de la base de datos
- Verificar que `SUPABASE_SERVICE_ROLE_KEY` esté configurada

### **Error: "Error interno del servidor"**
- Verificar logs del servidor
- Verificar conectividad con Supabase
- Verificar variables de entorno
