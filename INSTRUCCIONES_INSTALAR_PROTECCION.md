# 🛡️ INSTRUCCIONES: INSTALAR PROTECCIÓN SQL EN PRODUCCIÓN

## ⚠️ **CRÍTICO - HACER AHORA**

Para evitar que vuelva a ocurrir la pérdida de datos, debes instalar el sistema de protección SQL **MANUALMENTE** en Supabase.

---

## 📋 PASOS PARA INSTALAR

### 1. Abrir Supabase Dashboard

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a la sección **"SQL Editor"** en el menú lateral

### 2. Ejecutar el SQL de Protección

1. Haz clic en **"New query"**
2. Copia y pega el contenido del archivo: `db/install_protection_system.sql`
3. Haz clic en **"Run"** (o presiona `Ctrl+Enter`)

### 3. Verificar la Instalación

Ejecuta este SQL para verificar que se instaló correctamente:

```sql
-- Verificar tabla de auditoría
SELECT COUNT(*) as existe FROM information_schema.tables 
WHERE table_name = 'model_values_deletion_log';

-- Verificar trigger
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'model_values';

-- Verificar vista
SELECT COUNT(*) as existe FROM information_schema.views 
WHERE table_name = 'dangerous_deletions';
```

**Resultados esperados:**
- `model_values_deletion_log`: existe = 1
- Triggers: Debe mostrar `audit_model_values_deletion_trigger`
- `dangerous_deletions`: existe = 1

---

## 📂 ARCHIVOS

### Archivo a instalar:
```
db/install_protection_system.sql
```

### Contenido del archivo:

Crea:
1. **Tabla `model_values_deletion_log`**: Registra TODOS los borrados
2. **Trigger `audit_model_values_deletion_trigger`**: Se ejecuta ANTES de cada borrado
3. **Vista `dangerous_deletions`**: Muestra borrados SIN archivo previo
4. **Índices**: Para búsquedas rápidas

---

## 🎯 QUÉ HACE ESTE SISTEMA

### Antes (SIN protección):
```
Cron falla → Código no se ejecuta → Datos se borran → 💀 PÉRDIDA TOTAL
```

### Después (CON protección):
```
Alguien intenta borrar → Trigger SQL se ejecuta → Se registra en log → ✅ AUDITADO
                                                  ↓
                                            Si no hay archivo
                                                  ↓
                                            Lanza WARNING en logs
```

---

## 📊 CÓMO USAR EL SISTEMA

### Monitorear borrados peligrosos:

```sql
-- Ver borrados sin archivo previo
SELECT * FROM dangerous_deletions;
```

Si esta consulta retorna registros, significa que se borraron datos **SIN archivar**.

### Ver todos los borrados del último cierre:

```sql
SELECT 
    model_id,
    platform_id,
    value,
    period_date,
    deleted_at,
    archived_first
FROM model_values_deletion_log
WHERE deleted_at >= NOW() - INTERVAL '7 days'
ORDER BY deleted_at DESC;
```

---

## 🚨 IMPORTANTE

### Este sistema NO evita el borrado

El trigger **NO BLOQUEA** el borrado de datos. Solo:
- ✅ Registra el evento
- ✅ Verifica si había archivo
- ✅ Lanza WARNING en logs

Para **PREVENIR** el borrado, necesitas usar la función `safe_atomic_archive_and_delete()` del archivo `db/CRITICAL_FIX_prevent_data_loss.sql` (más avanzado).

---

## ✅ CHECKLIST

- [ ] Abrir Supabase Dashboard
- [ ] Ir a SQL Editor
- [ ] Copiar contenido de `db/install_protection_system.sql`
- [ ] Ejecutar el SQL
- [ ] Verificar con las consultas de verificación
- [ ] Confirmar que la tabla `model_values_deletion_log` existe
- [ ] Confirmar que el trigger está activo
- [ ] Documentar la fecha de instalación

---

## 📝 NOTAS

- **Tiempo de instalación**: ~30 segundos
- **Riesgo**: NINGUNO (solo crea estructuras, no modifica datos)
- **Impacto en performance**: MÍNIMO (el trigger es muy ligero)
- **Reversible**: SÍ (se puede eliminar el trigger si es necesario)

---

## 🆘 SI ALGO FALLA

Si el SQL falla al ejecutarse:

1. **Verifica que tienes permisos de admin** en Supabase
2. **Lee el mensaje de error** (puede que algo ya exista)
3. **Ejecuta statement por statement** (en lugar de todo junto)
4. **Contacta soporte de Supabase** si el problema persiste

---

**Fecha de creación:** 16/01/2026  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** ⏳ PENDIENTE DE INSTALACIÓN
