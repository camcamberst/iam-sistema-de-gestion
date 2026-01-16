# 📋 GUÍA: Cómo Ejecutar los Scripts de Verificación y Corrección

---

## ✅ REQUISITOS PREVIOS

### 1. **Node.js Instalado**

Verifica que tienes Node.js instalado:

```bash
node --version
```

**Debe mostrar:** `v18.x.x` o superior

Si no lo tienes, descárgalo de: https://nodejs.org/

---

### 2. **Dependencias Instaladas**

Asegúrate de tener las dependencias del proyecto instaladas:

```bash
npm install
```

O si usas yarn:

```bash
yarn install
```

---

### 3. **Archivo `.env.local` Configurado**

Asegúrate de tener el archivo `.env.local` en la raíz del proyecto con:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

**⚠️ IMPORTANTE:** Necesitas la `SUPABASE_SERVICE_ROLE_KEY` (no la clave pública)

---

## 🚀 EJECUCIÓN DE LOS SCRIPTS

### **OPCIÓN 1: Desde la Terminal/CMD (Windows)**

1. **Abre PowerShell o CMD**
2. **Navega a la carpeta del proyecto:**
   ```bash
   cd C:\Users\camca\OneDrive\Documentos\GitHub\iam-sistema-de-gestion
   ```

3. **Ejecuta el script:**
   ```bash
   node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
   ```

---

### **OPCIÓN 2: Desde VS Code (Terminal Integrada)**

1. **Abre VS Code en el proyecto**
2. **Abre la terminal integrada:** `Ctrl + Ñ` (o `View > Terminal`)
3. **Ejecuta el script:**
   ```bash
   node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
   ```

---

## 📝 SCRIPTS DISPONIBLES

### **1. Script de Verificación**

**Archivo:** `scripts/verificar_archivado_cierre_periodo.js`

**Uso:**
```bash
node scripts/verificar_archivado_cierre_periodo.js [period_date] [period_type]
```

**Ejemplo:**
```bash
node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
```

**Qué hace:**
- Verifica si hay registros en `calculator_history` para cada modelo
- Verifica si hay valores residuales en `model_values`
- Genera un reporte JSON con los resultados

**Salida esperada:**
```
🔍 VERIFICACIÓN DE ARCHIVADO DE CIERRE DE PERÍODO
============================================================
📅 Período: 16-31 (2025-12-16)
============================================================

📋 Paso 1: Obteniendo modelos activos...
✅ Encontrados 30 modelos activos

📊 REPORTE DE VERIFICACIÓN
============================================================
✅ Modelos con archivo completo: 25
❌ Modelos sin archivo: 5
⚠️ Modelos con valores residuales: 24
...
```

---

### **2. Script de Eliminación Segura**

**Archivo:** `scripts/eliminar_residuales_si_archivados.js`

**Uso:**
```bash
node scripts/eliminar_residuales_si_archivados.js [period_date] [period_type]
```

**Ejemplo:**
```bash
node scripts/eliminar_residuales_si_archivados.js 2025-12-16 16-31
```

**Qué hace:**
- Verifica que cada modelo tiene archivo en `calculator_history`
- Elimina valores residuales SOLO de modelos con archivo completo
- NO elimina valores de modelos sin archivo
- Genera un reporte detallado

**Salida esperada:**
```
🔧 ELIMINACIÓN DE VALORES RESIDUALES (Solo si están archivados)
============================================================
📅 Período: 16-31 (2025-12-16)
============================================================

📋 Paso 1: Obteniendo modelos con valores residuales...
✅ Encontrados 24 modelos con valores residuales

📋 Paso 2: Verificando archivos en calculator_history...
✅ Modelos con archivo: 20
⚠️ Modelos sin archivo: 4

📋 Paso 3: Eliminando valores residuales (solo modelos con archivo)...
📧 modelo1@email.com (48 valores residuales)
   ✅ Tiene archivo (12 registros). Eliminando valores residuales...
   ✅ 48 valores eliminados correctamente
...
```

---

## 🔍 VERIFICACIÓN PASO A PASO

### **PASO 1: Verificar Configuración**

Antes de ejecutar, verifica que todo está configurado:

```bash
# Verificar Node.js
node --version

# Verificar que existe .env.local
# (En Windows PowerShell)
Test-Path .env.local

# (En CMD)
if exist .env.local (echo Existe) else (echo No existe)
```

---

### **PASO 2: Ejecutar Verificación**

Primero, ejecuta el script de verificación para ver el estado actual:

```bash
node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
```

**Revisa el reporte generado:**
- Busca el archivo: `reporte_verificacion_archivado_2025-12-16_16_31.json`
- Revisa cuántos modelos tienen archivo y cuántos no

---

### **PASO 3: Ejecutar Eliminación (Solo si hay modelos con archivo)**

Si el reporte muestra que hay modelos con archivo, ejecuta:

```bash
node scripts/eliminar_residuales_si_archivados.js 2025-12-16 16-31
```

**El script te dirá:**
- ✅ Cuántos modelos se corrigieron exitosamente
- ⚠️ Cuántos modelos requieren archivado manual
- ❌ Si hubo algún error

---

## ⚠️ SOLUCIÓN DE PROBLEMAS

### **Error: "Cannot find module '@supabase/supabase-js'"**

**Solución:**
```bash
npm install @supabase/supabase-js
```

---

### **Error: "Cannot find module 'dotenv'"**

**Solución:**
```bash
npm install dotenv
```

---

### **Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"**

**Solución:**
1. Verifica que existe el archivo `.env.local` en la raíz del proyecto
2. Verifica que tiene las variables correctas:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   ```

---

### **Error: "connect ECONNREFUSED" o "Network Error"**

**Solución:**
1. Verifica tu conexión a internet
2. Verifica que la URL de Supabase es correcta
3. Verifica que el service role key es válido

---

### **El script se ejecuta pero no muestra nada**

**Solución:**
- Verifica que estás usando los parámetros correctos
- Verifica que el período existe (2025-12-16, 16-31)
- Revisa los logs para ver si hay errores silenciosos

---

## 📊 INTERPRETACIÓN DE RESULTADOS

### **Reporte de Verificación:**

```
✅ Modelos con archivo completo: 25
❌ Modelos sin archivo: 5
⚠️ Modelos con valores residuales: 24
```

**Interpretación:**
- ✅ **25 modelos con archivo:** Están correctamente archivados
- ❌ **5 modelos sin archivo:** Requieren archivado manual
- ⚠️ **24 modelos con residuales:** Tienen valores que deberían eliminarse

---

### **Reporte de Eliminación:**

```
✅ Exitosos (eliminados): 20
⚠️ Pendientes (requieren archivado): 4
❌ Errores: 0
```

**Interpretación:**
- ✅ **20 exitosos:** Valores residuales eliminados correctamente
- ⚠️ **4 pendientes:** Requieren archivado antes de eliminar
- ❌ **0 errores:** Todo funcionó correctamente

---

## 🎯 ORDEN RECOMENDADO DE EJECUCIÓN

1. **Primero:** Verificación
   ```bash
   node scripts/verificar_archivado_cierre_periodo.js 2025-12-16 16-31
   ```

2. **Segundo:** Revisar el reporte JSON generado

3. **Tercero:** Eliminación (solo si hay modelos con archivo)
   ```bash
   node scripts/eliminar_residuales_si_archivados.js 2025-12-16 16-31
   ```

4. **Cuarto:** Revisar el reporte final y verificar en Supabase

---

## 📝 NOTAS IMPORTANTES

- ⚠️ **Los scripts son seguros:** Solo eliminan valores si están archivados
- ✅ **Generan reportes:** Todos los resultados se guardan en archivos JSON
- 🔒 **No modifican datos sin verificación:** Siempre verifican antes de eliminar
- 📊 **Muestran progreso:** Verás el progreso en tiempo real

---

## 🆘 SI NECESITAS AYUDA

Si encuentras algún problema:

1. **Revisa los logs del script** (se muestran en la consola)
2. **Revisa el archivo de reporte JSON** generado
3. **Verifica la configuración** de `.env.local`
4. **Contacta al equipo** si el problema persiste

---

**¡Listo para ejecutar!** 🚀







