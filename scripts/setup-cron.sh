#!/bin/bash

# 🔄 CONFIGURACIÓN DE CRON JOB PARA CORTES AUTOMÁTICOS
# 
# Este script configura el cron job para ejecutar automáticamente
# el cierre de períodos los días 1 y 16 de cada mes a las 00:00
# en huso horario de Europa Central.

echo "🔄 Configurando cron job para cortes automáticos..."

# Obtener directorio del proyecto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_SCRIPT="$PROJECT_DIR/scripts/auto-close-period-cron.js"

# Verificar que el script existe
if [ ! -f "$CRON_SCRIPT" ]; then
    echo "❌ Error: No se encontró el script $CRON_SCRIPT"
    exit 1
fi

# Crear entrada de cron job
# Ejecutar a las 00:00 (medianoche) Europa Central los días 1 y 16
# Nota: El servidor debe estar configurado en huso horario de Europa Central
CRON_ENTRY="0 0 1,16 * * cd $PROJECT_DIR && node $CRON_SCRIPT >> /var/log/calculator-auto-close.log 2>&1"

# Agregar al crontab
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job configurado exitosamente"
echo "📅 Se ejecutará los días 1 y 16 de cada mes a las 00:00"
echo "📝 Logs se guardarán en: /var/log/calculator-auto-close.log"
echo ""
echo "🔍 Para verificar la configuración:"
echo "   crontab -l"
echo ""
echo "🔍 Para ver los logs:"
echo "   tail -f /var/log/calculator-auto-close.log"
