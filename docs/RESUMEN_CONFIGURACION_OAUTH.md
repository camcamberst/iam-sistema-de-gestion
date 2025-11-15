# ✅ Resumen: Configuración de Google OAuth - Lo que debes hacer

## 🎯 Estado Actual

✅ **Código implementado y listo**  
✅ **Credenciales OAuth obtenidas de Google**  
⏳ **Pendiente: Configurar variables de entorno**

---

## 📋 TUS CREDENCIALES

⚠️ **Tus credenciales están en el archivo JSON que descargaste:**
- **Client ID:** Está en el archivo JSON (campo `client_id`)
- **Client Secret:** Está en el archivo JSON (campo `client_secret`)
- **Dominio:** `iam-sistema-de-gestion.vercel.app`

💡 **Tip:** Abre el archivo JSON que descargaste para ver los valores exactos.

---

## 🔧 PASO 1: Configurar `.env.local` (5 minutos)

1. Abre el archivo `.env.local` en la raíz de tu proyecto
2. Agrega estas líneas al final:

```env
# Google OAuth 2.0
GOOGLE_CLIENT_ID=TU_CLIENT_ID_DEL_JSON
GOOGLE_CLIENT_SECRET=TU_CLIENT_SECRET_DEL_JSON
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **Reemplaza** `TU_CLIENT_ID_DEL_JSON` y `TU_CLIENT_SECRET_DEL_JSON` con los valores del archivo JSON que descargaste.

3. Guarda el archivo
4. Reinicia tu servidor: `npm run dev`

---

## 🌐 PASO 2: Configurar Vercel (10 minutos)

1. Ve a: https://vercel.com/
2. Selecciona tu proyecto: **iam-sistema-de-gestion**
3. Ve a: **Settings** > **Environment Variables**
4. Agrega estas 4 variables (una por una):

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | Valor del campo `client_id` en tu archivo JSON |
| `GOOGLE_CLIENT_SECRET` | Valor del campo `client_secret` en tu archivo JSON |
| `GOOGLE_REDIRECT_URI` | `https://iam-sistema-de-gestion.vercel.app/api/google-drive/callback` |
| `NEXT_PUBLIC_APP_URL` | `https://iam-sistema-de-gestion.vercel.app` |

**Para cada variable:**
- Marca las 3 opciones: ✅ Production, ✅ Preview, ✅ Development
- Haz clic en **Save**

5. **Haz un nuevo deploy** (Redeploy del último deployment)

---

## ✅ PASO 3: Probar

1. **Local:**
   - Ve a: http://localhost:3000/admin/sedes/portafolio
   - Haz clic en "Boost Pages" de cualquier modelo
   - Deberías poder autenticarte con Google y subir fotos

2. **Producción:**
   - Espera a que termine el deploy
   - Ve a: https://iam-sistema-de-gestion.vercel.app/admin/sedes/portafolio
   - Prueba "Boost Pages"

---

## 📚 Documentación Completa

- **Guía paso a paso OAuth:** `docs/GOOGLE_OAUTH_GUIA_PASO_A_PASO.md`
- **Configuración de variables:** `docs/CONFIGURACION_VARIABLES_ENTORNO.md`

---

## 🆘 Si algo no funciona

1. Verifica que las variables estén escritas correctamente (sin espacios)
2. Verifica que reiniciaste el servidor después de agregar variables locales
3. Verifica que hiciste redeploy en Vercel después de agregar variables
4. Revisa la consola del navegador para errores
5. Revisa los logs de Vercel

---

## 🎉 ¡Listo!

Una vez completados estos 2 pasos, la funcionalidad de drag & drop estará completamente operativa.

