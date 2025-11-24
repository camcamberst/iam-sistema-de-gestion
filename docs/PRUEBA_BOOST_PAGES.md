# ✅ Guía de Prueba: Boost Pages

## 🎯 Cómo Probar la Funcionalidad

### Paso 1: Reiniciar Servidor Local (si está corriendo)

Si tienes el servidor de desarrollo corriendo:
1. Detén el servidor (presiona `Ctrl + C` en la terminal)
2. Inícialo de nuevo:
   ```bash
   npm run dev
   ```

### Paso 2: Probar en Desarrollo Local

1. **Abre tu navegador** y ve a: http://localhost:3000
2. **Inicia sesión** con tu cuenta de admin
3. **Navega a:** "Portafolio Modelos" (`/admin/sedes/portafolio`)
4. **Busca cualquier modelo** en la lista
5. **Haz clic en el botón "Boost Pages"** (botón con gradiente púrpura-rosa)
6. **Se abrirá el modal** con las opciones:
   - Configuración de Google Drive (si no está configurado)
   - Componente de drag & drop para subir fotos
   - Opción para abrir Google Drive en nueva pestaña

### Paso 3: Configurar Google Drive (Primera Vez)

Si es la primera vez que usas "Boost Pages" para una modelo:

1. En el modal, haz clic en **"Configurar Google Drive"**
2. Pega el enlace completo de la carpeta de Google Drive de la modelo
   - Ejemplo: `https://drive.google.com/drive/folders/1_Dg8zUvjCAkGpOqa1ZngFyLx0XKT8lWf`
3. Haz clic en **"Guardar"**
4. Verás un mensaje de éxito

### Paso 4: Probar Autenticación OAuth (Primera Vez)

La primera vez que intentes usar el drag & drop:

1. **Selecciona una carpeta** del dropdown (si hay carpetas disponibles)
2. **Arrastra una foto** o haz clic para seleccionar
3. **Si no estás autenticado**, serás redirigido a Google para autorizar
4. **Autoriza el acceso** a Google Drive
5. **Serás redirigido de vuelta** a la aplicación
6. **Ahora podrás subir fotos** directamente

### Paso 5: Subir Fotos

1. **Arrastra fotos** a la zona de drag & drop
   - O haz clic para seleccionar archivos
2. **Selecciona la carpeta destino** del dropdown
3. **Haz clic en "Subir X archivo(s)"**
4. **Verás el progreso** de cada archivo:
   - ⏳ Subiendo...
   - ✅ Éxito
   - ❌ Error (si algo falla)

### Paso 6: Probar en Producción

1. **Espera a que termine el deploy** en Vercel
2. **Ve a:** https://iam-sistema-de-gestion.vercel.app
3. **Sigue los mismos pasos** que en desarrollo local

---

## 🔍 Qué Verificar

### ✅ Funcionalidades que Deben Funcionar

- [ ] El botón "Boost Pages" aparece en cada modelo
- [ ] El modal se abre correctamente
- [ ] Puedes configurar el enlace de Google Drive
- [ ] Puedes ver las carpetas disponibles (después de autenticarte)
- [ ] Puedes arrastrar y soltar fotos
- [ ] Puedes seleccionar archivos haciendo clic
- [ ] Puedes seleccionar la carpeta destino
- [ ] Los archivos se suben correctamente
- [ ] Ves el progreso de cada archivo
- [ ] Los archivos aparecen en el Google Drive

### ⚠️ Posibles Problemas

**Si no puedes autenticarte:**
- Verifica que las variables de entorno estén configuradas correctamente
- Verifica que el redirect URI en Google Cloud Console coincida exactamente
- Revisa la consola del navegador para ver errores

**Si no aparecen carpetas:**
- Verifica que el folder ID sea correcto
- Verifica que el Google Drive tenga carpetas dentro
- Revisa los logs del servidor para ver errores

**Si los archivos no se suben:**
- Verifica que estés autenticado con Google
- Verifica que tengas permisos en el Google Drive
- Revisa los logs del servidor para ver errores

---

## 🎉 ¡Listo para Usar!

Una vez que todo funcione, podrás:
- ✅ Subir fotos directamente desde el AIM
- ✅ Seleccionar la carpeta destino
- ✅ Ver el progreso en tiempo real
- ✅ No salir del sitio para subir archivos

---

## 📞 Si Necesitas Ayuda

Si algo no funciona:
1. Revisa la consola del navegador (F12 > Console)
2. Revisa los logs de Vercel (si es en producción)
3. Verifica que todas las variables de entorno estén configuradas
4. Verifica que el Google Drive tenga las carpetas correctas





