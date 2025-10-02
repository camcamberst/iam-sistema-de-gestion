# 🔄 Sistema de Cortes Automáticos - Configuración

## 📋 Resumen

Este documento describe cómo configurar el sistema de cortes automáticos para la calculadora, que ejecuta los días 1 y 16 de cada mes a las 00:00 (medianoche) en huso horario de Europa Central.

## 🎯 Funcionalidades

### ✅ Implementado
- **API de cierre automático**: `/api/calculator/auto-close-period`
- **Script de cron job**: `scripts/auto-close-period-cron.js`
- **Integración UI**: "Mi Historial" en menú de calculadora
- **Huso horario**: Europa Central para todas las operaciones

### 🔄 Proceso Automático
1. **Archivar valores** actuales a tabla `calculator_history`
2. **Resetear calculadora** eliminando valores de `model_values`
3. **Preparar nuevo período** con calculadora en ceros
4. **Registrar logs** de todas las operaciones

## 🛠️ Configuración

### 1. Configurar Cron Job (Linux/Unix)

```bash
# Ejecutar script de configuración
./scripts/setup-cron.sh

# Verificar configuración
crontab -l

# Ver logs
tail -f /var/log/calculator-auto-close.log
```

### 2. Configurar Cron Job (Windows)

```powershell
# Crear tarea programada
schtasks /create /tn "Calculator Auto Close" /tr "node scripts/auto-close-period-cron.js" /sc monthly /d 1,16 /st 00:00 /f
```

### 3. Configurar Variables de Entorno

```env
# .env.local
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
CRON_SECRET=tu-secreto-para-cron
```

## 📊 Monitoreo

### Verificar Estado del Sistema
```bash
curl -X GET https://tu-dominio.com/api/calculator/auto-close-period
```

### Ejecutar Manualmente
```bash
# Ejecutar cierre automático manualmente
node scripts/auto-close-period-cron.js
```

## 🗂️ Estructura de Base de Datos

### Tabla `model_values` (Valores Actuales)
- Almacena valores del período actual
- Se resetea en cada corte automático

### Tabla `calculator_history` (Históricos)
- Almacena valores archivados de períodos anteriores
- Se consulta en "Mi Historial"

## 🎯 Reglas de Negocio

### Períodos
- **Período 1**: Días 1-15 del mes
- **Período 2**: Días 16-31 del mes

### Cortes
- **Días**: 1 y 16 de cada mes
- **Hora**: 00:00 (medianoche)
- **Huso horario**: Europa Central (Europe/Berlin)

### Acciones
1. **Archivar** valores actuales a históricos
2. **Eliminar** valores actuales (resetear)
3. **Preparar** nuevo período con ceros
4. **Registrar** logs de operación

## 🔍 Troubleshooting

### Problemas Comunes

1. **Cron job no ejecuta**
   - Verificar permisos del script
   - Verificar configuración de crontab
   - Revisar logs del sistema

2. **Error de conexión a API**
   - Verificar `NEXT_PUBLIC_APP_URL`
   - Verificar que el servidor esté ejecutándose
   - Revisar logs de la aplicación

3. **Error de base de datos**
   - Verificar conexión a Supabase
   - Verificar permisos de `SUPABASE_SERVICE_ROLE_KEY`
   - Revisar logs de Supabase

### Logs Importantes

```bash
# Logs del cron job
tail -f /var/log/calculator-auto-close.log

# Logs de la aplicación
tail -f logs/app.log

# Logs de Supabase (en dashboard)
# https://supabase.com/dashboard/project/[PROJECT_ID]/logs
```

## ✅ Verificación

### Checklist de Implementación
- [ ] API `/api/calculator/auto-close-period` funciona
- [ ] Script `auto-close-period-cron.js` ejecuta correctamente
- [ ] Cron job configurado y programado
- [ ] "Mi Historial" muestra datos correctamente
- [ ] Huso horario Europa Central en todas las operaciones
- [ ] Logs se generan correctamente
- [ ] Reset automático funciona

### Pruebas Recomendadas
1. **Ejecutar manualmente** el script de cron
2. **Verificar** que se archivan los valores
3. **Verificar** que se resetea la calculadora
4. **Verificar** que "Mi Historial" muestra los datos
5. **Simular** corte automático en fecha de prueba
