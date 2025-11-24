# 🚀 Prueba en Producción: Boost Pages

## ✅ Checklist Antes de Probar

### 1. Verificar Variables de Entorno en Vercel

Asegúrate de que estas 4 variables estén configuradas en Vercel:

| Variable | Valor Esperado |
|----------|----------------|
| `GOOGLE_CLIENT_ID` | `[TU_GOOGLE_CLIENT_ID]` |
| `GOOGLE_CLIENT_SECRET` | `[TU_GOOGLE_CLIENT_SECRET]` |
| `GOOGLE_REDIRECT_URI` | `https://iam-sistema-de-gestion.vercel.app/api/google-drive/callback` |
| `NEXT_PUBLIC_APP_URL` | `https://iam-sistema-de-gestion.vercel.app` |

**Cómo verificar:**
1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto: **iam-sistema-de-gestion**
3. Ve a: **Settings** > **Environment Variables**
4. Verifica que las 4 variables estén presentes
5. Si faltan, agrégalas y marca: ✅ Production, ✅ Preview, ✅ Development

### 2. Verificar que el Deploy Esté Completo

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a la pestaña **Deployments**
4. Verifica que el último deploy esté en estado **✅ Ready**
5. Si hay errores, revisa los logs

---

## 🧪 Pasos para Probar

### Paso 1: Acceder a la Aplicación

1. Abre tu navegador
2. Ve a: **https://iam-sistema-de-gestion.vercel.app**
3. Inicia sesión con tu cuenta de admin

### Paso 2: Navegar a Portafolio Modelos

1. En el menú lateral, busca **"Portafolio Modelos"**
2. O ve directamente a: `https://iam-sistema-de-gestion.vercel.app/admin/sedes/portafolio`
3. Deberías ver la lista de modelos con sus plataformas

### Paso 3: Abrir Boost Pages

1. Busca cualquier modelo en la lista (por ejemplo: **HollyRogers**)
2. Verás un botón con gradiente púrpura-rosa que dice **"Boost Pages"**
3. Haz clic en el botón
4. Se abrirá un modal

### Paso 4: Configurar Google Drive (Primera Vez)

Si es la primera vez que usas Boost Pages para esta modelo:

1. En el modal, verás una sección de **"Configuración"**
2. Pega el enlace completo de Google Drive de la modelo
   - Ejemplo: `https://drive.google.com/drive/folders/1_Dg8zUvjCAkGpOqa1ZngFyLx0XKT8lWf`
3. Haz clic en **"Guardar"**
4. Deberías ver un mensaje de éxito: ✅ "Configuración guardada exitosamente"

### Paso 5: Autenticarse con Google (Primera Vez)

La primera vez que intentes usar el drag & drop:

1. **Selecciona una carpeta** del dropdown (si hay carpetas disponibles)
2. **Arrastra una foto** o haz clic para seleccionar archivos
3. **Si no estás autenticado**, verás un mensaje indicando que necesitas autenticarte
4. **Haz clic en "Autenticar con Google"** o el botón correspondiente
5. **Serás redirigido a Google** para autorizar el acceso
6. **Selecciona tu cuenta de Google** y autoriza el acceso
7. **Serás redirigido de vuelta** a la aplicación
8. **Ahora podrás subir fotos** directamente

### Paso 6: Subir Fotos

1. **Arrastra fotos** a la zona de drag & drop
   - O haz clic en "Seleccionar archivos"
2. **Selecciona la carpeta destino** del dropdown
3. **Haz clic en "Subir X archivo(s)"**
4. **Verás el progreso** de cada archivo:
   - ⏳ Subiendo...
   - ✅ Éxito
   - ❌ Error (si algo falla)

### Paso 7: Verificar en Google Drive

1. Abre el Google Drive de la modelo en otra pestaña
2. Ve a la carpeta donde subiste la foto
3. **Verifica que la foto esté ahí**

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

---

## ⚠️ Solución de Problemas

### Problema: "Google OAuth no está configurado"

**Solución:**
- Verifica que las variables de entorno estén en Vercel
- Haz un **Redeploy** después de agregar las variables

### Problema: "Error al autenticar con Google"

**Solución:**
- Verifica que el `GOOGLE_REDIRECT_URI` en Vercel coincida exactamente con el configurado en Google Cloud Console
- Debe ser: `https://iam-sistema-de-gestion.vercel.app/api/google-drive/callback`

### Problema: "No aparecen carpetas"

**Solución:**
- Verifica que el folder ID sea correcto
- Verifica que el Google Drive tenga carpetas dentro
- Asegúrate de estar autenticado con Google

### Problema: "Los archivos no se suben"

**Solución:**
- Verifica que estés autenticado con Google
- Verifica que tengas permisos en el Google Drive
- Revisa la consola del navegador (F12 > Console) para ver errores

### Problema: "Error 500 en el servidor"

**Solución:**
- Revisa los logs de Vercel en la pestaña **Functions**
- Verifica que todas las variables de entorno estén configuradas
- Verifica que el Google Drive tenga las carpetas correctas

---

## 📊 Verificar Logs en Vercel

Si algo no funciona:

1. Ve a: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a la pestaña **Functions**
4. Busca los endpoints:
   - `/api/google-drive/auth`
   - `/api/google-drive/callback`
   - `/api/google-drive/folders`
   - `/api/google-drive/upload`
5. Revisa los logs para ver errores

---

## 🎉 ¡Listo!

Si todo funciona correctamente, ya puedes usar Boost Pages en producción para subir fotos directamente desde el AIM.





