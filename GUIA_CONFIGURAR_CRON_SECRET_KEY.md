# 🔐 GUÍA: Configurar CRON_SECRET_KEY en Vercel

Esta guía te ayudará a configurar la variable de entorno `CRON_SECRET_KEY` necesaria para que los cron jobs funcionen correctamente en producción.

---

## 📋 PASOS PARA CONFIGURAR CRON_SECRET_KEY

### Paso 1: Generar una Secret Key

Tienes dos opciones para generar una clave secreta segura:

#### Opción A: Usando OpenSSL (Recomendado)
```bash
# En terminal (PowerShell, CMD, o Git Bash)
openssl rand -hex 32
```

Esto generará una cadena de 64 caracteres hexadecimales, por ejemplo:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

#### Opción B: Usando Node.js
```bash
# En terminal
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Opción C: Usando PowerShell (Windows)
```powershell
# En PowerShell
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**⚠️ IMPORTANTE:** Guarda esta clave en un lugar seguro. La necesitarás para:
- Configurarla en Vercel
- Usarla en pruebas manuales de los endpoints
- Referenciarla en scripts de testing

---

### Paso 2: Acceder a Vercel Dashboard

1. Abre tu navegador y ve a: https://vercel.com
2. Inicia sesión con tu cuenta
3. Selecciona el proyecto: **iam-sistema-de-gestion**

---

### Paso 3: Navegar a Environment Variables

1. En el dashboard del proyecto, haz clic en **Settings** (Configuración)
2. En el menú lateral izquierdo, haz clic en **Environment Variables**
3. Verás una lista de todas las variables de entorno configuradas

---

### Paso 4: Agregar la Variable CRON_SECRET_KEY

1. Haz clic en el botón **Add New** (Agregar Nueva)
2. Completa el formulario:
   - **Key (Nombre):** `CRON_SECRET_KEY`
   - **Value (Valor):** Pega la clave secreta que generaste en el Paso 1
   - **Environment (Entorno):** Selecciona:
     - ✅ **Production** (obligatorio para cron jobs)
     - ✅ **Preview** (opcional, para pruebas)
     - ✅ **Development** (opcional, para desarrollo local)
   
   **Recomendación:** Marca al menos **Production** y **Preview**

3. Haz clic en **Save** (Guardar)

---

### Paso 5: Verificar la Configuración

1. Verifica que la variable aparece en la lista con:
   - Nombre: `CRON_SECRET_KEY`
   - Entornos: Los que seleccionaste (Production, Preview, etc.)
   - Valor: `••••••••` (oculto por seguridad)

2. **IMPORTANTE:** Si ya tienes un deployment activo, necesitas hacer un nuevo deployment para que la variable tome efecto:
   - Opción A: Haz un push a `main` (trigger automático)
   - Opción B: Ve a **Deployments** → Selecciona el último deployment → **Redeploy**

---

### Paso 6: Verificar en el Código

El código ya está preparado para usar esta variable. Verifica que los endpoints la usen correctamente:

**Archivos que usan CRON_SECRET_KEY:**
- `app/api/cron/period-closure-early-freeze/route.ts`
- `app/api/cron/period-closure-full-close/route.ts`
- `app/api/calculator/period-closure/close-period/route.ts` (para ejecución manual)

**Ejemplo de uso en el código:**
```typescript
const cronSecret = process.env.CRON_SECRET_KEY || 'cron-secret';
const authHeader = request.headers.get('authorization');
const providedSecret = authHeader?.replace('Bearer ', '');

if (providedSecret !== cronSecret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## 🧪 PROBAR LA CONFIGURACIÓN

### Prueba 1: Verificar que la Variable Está Disponible

Puedes crear un endpoint temporal de prueba:

```typescript
// app/api/test-cron-secret/route.ts (TEMPORAL - ELIMINAR DESPUÉS)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET_KEY;
  
  return NextResponse.json({
    secret_configured: !!secret,
    secret_length: secret?.length || 0,
    secret_preview: secret ? `${secret.substring(0, 8)}...` : 'NOT SET'
  });
}
```

Luego visita: `https://tu-app.vercel.app/api/test-cron-secret`

**⚠️ RECUERDA:** Eliminar este endpoint después de probar.

---

### Prueba 2: Probar Cron Job Manualmente

Puedes probar que el cron job funciona con la secret key:

```bash
# Desde terminal o Postman
curl -X GET https://tu-app.vercel.app/api/cron/period-closure-early-freeze \
  -H "Authorization: Bearer TU_SECRET_KEY_AQUI"
```

Deberías recibir una respuesta JSON indicando si es el momento correcto para ejecutar el early freeze.

---

## 🔍 VERIFICAR EN LOGS

1. Ve a Vercel Dashboard → Tu Proyecto → **Deployments**
2. Selecciona el último deployment
3. Haz clic en **Functions** → Busca los cron jobs
4. Revisa los logs para ver si hay errores relacionados con autenticación

---

## ⚠️ TROUBLESHOOTING

### Problema: La variable no se aplica después del deployment

**Solución:**
1. Verifica que la variable está marcada para **Production**
2. Haz un nuevo deployment (push a main o redeploy manual)
3. Espera 1-2 minutos para que el deployment se complete

---

### Problema: Los cron jobs fallan con "Unauthorized"

**Solución:**
1. Verifica que `CRON_SECRET_KEY` está configurada correctamente
2. Verifica que el deployment tiene la variable (revisa logs)
3. Verifica que Vercel está usando la secret key correcta en los cron jobs

**Nota:** Vercel automáticamente pasa la secret key en el header `Authorization` cuando ejecuta cron jobs, pero puedes verificar esto en los logs.

---

### Problema: No puedo generar la secret key

**Solución Alternativa:**
Puedes usar cualquier cadena segura de al menos 32 caracteres. Por ejemplo:
```
mi-clave-secreta-super-segura-2025-vercel-cron-123456789
```

Aunque es mejor usar una clave generada aleatoriamente.

---

## 📝 NOTAS IMPORTANTES

1. **Seguridad:**
   - Nunca compartas la secret key públicamente
   - No la incluyas en commits de git
   - Guárdala en un gestor de contraseñas seguro

2. **Entornos:**
   - Los cron jobs en Vercel solo se ejecutan en **Production**
   - La variable debe estar configurada al menos para Production
   - Puedes usar diferentes keys para diferentes entornos si lo deseas

3. **Rotación:**
   - Es buena práctica rotar las secret keys periódicamente
   - Si necesitas cambiarla, simplemente actualiza el valor en Vercel y haz un nuevo deployment

---

## ✅ CHECKLIST DE CONFIGURACIÓN

- [ ] Generé una secret key segura (64 caracteres hexadecimales)
- [ ] Guardé la secret key en un lugar seguro
- [ ] Accedí a Vercel Dashboard → Settings → Environment Variables
- [ ] Agregué `CRON_SECRET_KEY` con el valor generado
- [ ] Marqué al menos **Production** como entorno
- [ ] Guardé los cambios
- [ ] Hice un nuevo deployment (o verifiqué que está activo)
- [ ] Verifiqué que la variable aparece en la lista
- [ ] Probé manualmente un endpoint con la secret key

---

## 🎯 RESULTADO ESPERADO

Una vez configurada correctamente:

1. ✅ Los cron jobs se ejecutarán automáticamente en los horarios programados
2. ✅ Los endpoints aceptarán requests con la secret key correcta
3. ✅ Los logs no mostrarán errores de autenticación
4. ✅ El sistema de cierre funcionará completamente en producción

---

**Última actualización:** 16 de Diciembre 2025

