# 🔍 Verificación Post-Deploy: Sistema de Cierre de Períodos

**Fecha:** 31 de Octubre 2025 - 21:00 Colombia  
**Estado:** ✅ Deploy completado

---

## 📊 Contexto del Día de Prueba

- **Fecha Colombia:** 31 de Octubre 2025, ~21:00
- **Fecha Europa Central:** 1 de Noviembre 2025 (ya pasó medianoche)
- **Día de Cierre:** ✅ **MAÑANA ES DÍA 1** (día de cierre)
- **Prueba Early Freeze:** ✅ Ya debería haber ocurrido (medianoche Europa Central)

---

## ✅ Verificaciones Inmediatas

### 1. Verificar Tablas en Supabase
```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'calculator_period_closure_status',
  'calculator_early_frozen_platforms'
);
```

### 2. Verificar Early Freeze (Ya debería haber ocurrido)
```sql
-- Verificar si hay plataformas congeladas hoy
SELECT * 
FROM calculator_early_frozen_platforms 
WHERE period_date = '2025-11-01'
ORDER BY frozen_at DESC;

-- Verificar estado de cierre
SELECT * 
FROM calculator_period_closure_status 
WHERE period_date = '2025-11-01'
ORDER BY created_at DESC 
LIMIT 5;
```

### 3. Verificar Endpoints (Desde Consola del Navegador)
```javascript
// Verificar estado actual
fetch('/api/calculator/period-closure/check-status')
  .then(r => r.json())
  .then(console.log);

// Verificar si hay plataformas congeladas (necesita modelId)
fetch('/api/calculator/period-closure/platform-freeze-status?modelId=TU_MODEL_ID')
  .then(r => r.json())
  .then(console.log);
```

---

## 🕐 Próximos Eventos Esperados

### Esta Noche (31 Oct - 1 Nov):
- ⏰ **00:00 Colombia (05:00 UTC del 1 Nov)**: Full Close se ejecutará
  - Archivará período 16-31 de Octubre
  - Reseteará calculadoras a 0.00
  - Notificará a modelos y admins

### Mañana (1 Nov):
- ✅ Verificar en logs de Vercel que Full Close se ejecutó
- ✅ Verificar que calculadoras se resetearon
- ✅ Verificar que datos se archivaron en `calculator_history`
- ✅ Verificar notificaciones AIM Botty

---

## 📋 Checklist de Verificación Post-Deploy

### Inmediato (Ahora):
- [ ] Verificar que deploy se completó sin errores en Vercel
- [ ] Verificar que tablas existen en Supabase
- [ ] Verificar logs de Vercel para errores

### Esta Noche (00:00 Colombia):
- [ ] Monitorear logs de Vercel cuando llegue la hora
- [ ] Verificar que cron job `/api/cron/period-closure-full-close` se ejecuta
- [ ] Verificar que endpoint `/api/calculator/period-closure/close-period` responde

### Mañana (1 Nov - Día de Cierre):
- [ ] Verificar que calculadoras se resetearon a 0.00
- [ ] Verificar que datos están en `calculator_history`
- [ ] Verificar que modelos recibieron notificación AIM Botty
- [ ] Verificar que admins recibieron notificación
- [ ] Verificar que Resumen de Facturación puede leer de `calculator_history`

---

## 🔧 Comandos Útiles para Verificación

### Desde Supabase SQL Editor:
```sql
-- Ver estado de cierre más reciente
SELECT 
  period_date,
  period_type,
  status,
  current_step,
  total_steps,
  started_at,
  completed_at,
  error_message
FROM calculator_period_closure_status
ORDER BY created_at DESC
LIMIT 10;

-- Ver plataformas congeladas
SELECT 
  cefp.*,
  u.email as model_email
FROM calculator_early_frozen_platforms cefp
LEFT JOIN users u ON cefp.model_id = u.id
WHERE period_date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY frozen_at DESC;

-- Ver valores archivados hoy
SELECT 
  COUNT(*) as total_archived,
  COUNT(DISTINCT model_id) as models_with_data,
  period_date,
  period_type
FROM calculator_history
WHERE archived_at >= CURRENT_DATE
GROUP BY period_date, period_type;
```

### Desde Consola del Navegador (DevTools):
```javascript
// Verificar estado de cierre
fetch('/api/calculator/period-closure/check-status')
  .then(r => r.json())
  .then(data => {
    console.log('📊 Estado de Cierre:', data);
    if (data.status) {
      console.log(`✅ Estado: ${data.status}`);
      console.log(`📅 Período: ${data.period_date} (${data.period_type})`);
    } else {
      console.log('ℹ️ No hay cierre en curso');
    }
  });

// Para modelos: Verificar plataformas congeladas
// (Reemplazar YOUR_MODEL_ID con el ID real)
const modelId = 'YOUR_MODEL_ID';
fetch(`/api/calculator/period-closure/platform-freeze-status?modelId=${modelId}`)
  .then(r => r.json())
  .then(data => {
    console.log('🔒 Plataformas Congeladas:', data);
    if (data.frozen_platforms && data.frozen_platforms.length > 0) {
      console.log(`✅ ${data.frozen_platforms.length} plataformas congeladas:`);
      data.frozen_platforms.forEach(p => console.log(`   - ${p.toUpperCase()}`));
    } else {
      console.log('ℹ️ No hay plataformas congeladas para este modelo');
    }
  });
```

---

## 🚨 Posibles Problemas y Soluciones

### Problema 1: Cron job no se ejecuta
**Solución:**
1. Verificar logs de Vercel
2. Verificar que `vercel.json` está en la rama correcta
3. Ejecutar manualmente: `POST /api/calculator/period-closure/manual-close` (requiere super_admin)

### Problema 2: Early Freeze no ocurrió
**Solución:**
1. Verificar cálculo de hora Europa Central
2. Ejecutar manualmente con modo testing:
```javascript
fetch('/api/calculator/period-closure/early-freeze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-testing-mode': 'true'
  }
});
```

### Problema 3: Full Close falla
**Solución:**
1. Verificar logs en Vercel
2. Verificar que hay modelos activos
3. Verificar permisos de service role key
4. Usar `manual-close` para recuperación

---

## 📞 Contacto para Soporte

Si encuentras algún problema:
1. Revisar logs de Vercel
2. Verificar estado en Supabase
3. Usar endpoints manuales si es necesario
4. Documentar el problema para análisis

---

**✅ Sistema desplegado y listo para verificación**


