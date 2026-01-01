# 🚀 EJECUTAR ARCHIVADO DESDE PRODUCCIÓN

**Endpoint creado:** `/api/admin/emergency-archive-p2`

---

## ✅ OPCIÓN 1: Desde la Consola del Navegador (Producción)

1. **Abre tu aplicación en producción**
2. **Abre la consola del navegador** (F12)
3. **Ejecuta este código:**

```javascript
fetch('/api/admin/emergency-archive-p2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-service-key': 'TU_SERVICE_ROLE_KEY_AQUI'
  }
})
.then(r => r.json())
.then(data => {
  console.log('📊 RESULTADO:', data);
  if (data.success) {
    console.log('✅ Archivado exitoso');
    console.log(`   Modelos procesados: ${data.resumen.total_modelos}`);
    console.log(`   Exitosos: ${data.resumen.exitosos}`);
    console.log(`   Registros archivados: ${data.resumen.total_archivados}`);
    console.log(`   Valores en model_values: ${data.resumen.valores_en_model_values} (se mantienen)`);
  } else {
    console.error('❌ Error:', data.error);
  }
})
.catch(error => console.error('❌ Error:', error));
```

**⚠️ IMPORTANTE:** Reemplaza `'TU_SERVICE_ROLE_KEY_AQUI'` con tu service role key real.

---

## ✅ OPCIÓN 2: Desde Postman o cURL

```bash
curl -X POST https://tu-dominio-produccion.com/api/admin/emergency-archive-p2 \
  -H "Content-Type: application/json" \
  -H "x-service-key: TU_SERVICE_ROLE_KEY_AQUI"
```

---

## ✅ OPCIÓN 3: Crear Botón Temporal en la UI

Puedo crear un botón temporal en el admin panel para ejecutar el archivado con un clic.

---

## 📋 QUÉ HACE EL ENDPOINT

1. ✅ Lee valores de `model_values` del período 16-31 de diciembre
2. ✅ Solo valores hasta las 23:59:59 del 31 de diciembre
3. ✅ Archiva en `calculator_history` con detalle por plataforma
4. ✅ Verifica que se insertaron correctamente
5. ✅ NO elimina valores de `model_values` (se mantienen para verificación)
6. ✅ Retorna reporte detallado

---

## 🔒 SEGURIDAD

- Requiere `x-service-key` o `Authorization Bearer`
- Solo archiva, NO elimina
- Verifica cada paso antes de continuar

---

¿Quieres que cree un botón temporal en el admin panel para ejecutarlo más fácilmente?

