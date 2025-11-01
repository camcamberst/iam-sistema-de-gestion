# 🧪 Instrucciones para Probar Endpoints

## ✅ Estado Actual

**Verificado en Supabase:**
- ✅ Tablas creadas correctamente
- ✅ 10 plataformas especiales encontradas y activas
- ✅ Estructura completa lista

## 🚀 Para Probar los Endpoints

### Opción 1: Iniciar Servidor en Desarrollo

1. Abre una terminal en el proyecto
2. Ejecuta:
   ```bash
   npm run dev
   ```
3. Espera a que aparezca: `Ready on http://localhost:3000`
4. Luego ejecuta el script de testing:
   ```bash
   node scripts/test-period-closure-with-auth.js
   ```

### Opción 2: Probar desde el Navegador

1. Asegúrate de que el servidor esté corriendo (`npm run dev`)
2. Abre tu navegador y ve a tu aplicación
3. Abre la consola del navegador (F12 → Console)
4. Ejecuta:

```javascript
// Test 1: Verificar estado
fetch('/api/calculator/period-closure/check-status')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Estado:', data);
  })
  .catch(err => console.error('❌ Error:', err));
```

### Opción 3: Probar Manualmente con Postman/cURL

Si el servidor está en producción o en otra URL:

```bash
# Verificar estado
curl https://tu-dominio.com/api/calculator/period-closure/check-status

# O si está en localhost:
curl http://localhost:3000/api/calculator/period-closure/check-status
```

---

## 📋 Checklist de Verificación

### ✅ Completado
- [x] Tablas creadas en Supabase
- [x] Plataformas especiales verificadas
- [x] Scripts de testing creados
- [x] Endpoints implementados

### ⏳ Pendiente (requiere servidor corriendo)
- [ ] Endpoint `check-status` funciona
- [ ] Endpoint `early-freeze` funciona (requiere modificar validación temporalmente)
- [ ] Endpoint `close-period` funciona (requiere modificar validación temporalmente)
- [ ] Notificaciones AIM Botty funcionan
- [ ] Cron jobs ejecutándose correctamente

---

## 🔧 Testing Avanzado

Para probar early-freeze o close-period sin esperar la fecha/hora exacta:

1. Modifica temporalmente `utils/period-closure-dates.ts`:

```typescript
// TEMPORAL PARA TESTING
export const isEarlyFreezeTime = (): boolean => {
  return true; // Cambiar a true temporalmente
};

export const isFullClosureTime = (): boolean => {
  return true; // Cambiar a true temporalmente
};

export const isClosureDay = (): boolean => {
  return true; // Cambiar a true temporalmente
};
```

2. Ejecuta el endpoint desde consola del navegador:

```javascript
// Test early-freeze
fetch('/api/calculator/period-closure/early-freeze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
  .then(r => r.json())
  .then(console.log);
```

3. **IMPORTANTE:** Revierte los cambios después de testing.

---

## 📊 Verificar Resultados en Supabase

Después de ejecutar early-freeze, verifica:

```sql
-- Ver plataformas congeladas
SELECT * FROM calculator_early_frozen_platforms 
ORDER BY frozen_at DESC
LIMIT 20;

-- Ver estado del cierre
SELECT * FROM calculator_period_closure_status 
ORDER BY created_at DESC;
```

Después de ejecutar close-period, verifica:

```sql
-- Ver valores archivados
SELECT * FROM calculator_history 
ORDER BY archived_at DESC
LIMIT 20;

-- Verificar que model_values fueron eliminados
SELECT COUNT(*) as valores_actuales 
FROM model_values 
WHERE period_date = CURRENT_DATE;
-- Debe ser 0 o muy bajo
```

---

## ⚠️ Notas Importantes

1. **NO probar en producción** sin revisar cuidadosamente
2. **Siempre revertir cambios temporales** después de testing
3. Los cron jobs se ejecutarán automáticamente los días 1 y 16
4. Para testing manual, modifica validaciones temporalmente

