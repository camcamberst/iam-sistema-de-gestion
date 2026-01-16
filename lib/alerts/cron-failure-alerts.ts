/**
 * 🚨 SISTEMA DE ALERTAS CRÍTICAS PARA CRON JOBS
 * 
 * Envía notificaciones INMEDIATAS si un cron job falla
 */

import { createClient } from '@supabase/supabase-js';
import { sendBotNotification } from '@/lib/chat/bot-notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

interface CronFailureAlert {
  cronName: string;
  expectedTime: string;
  actualTime: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Envía alerta INMEDIATA a todos los super_admin si un cron falla
 */
export const sendCronFailureAlert = async (alert: CronFailureAlert): Promise<void> => {
  try {
    console.log('🚨 [CRON-ALERT] Enviando alerta de fallo crítico de cron:', alert.cronName);

    // 1. Obtener todos los super_admin
    const { data: superAdmins, error: adminError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    if (adminError || !superAdmins || superAdmins.length === 0) {
      console.error('❌ [CRON-ALERT] No se pudieron obtener super_admins:', adminError);
      return;
    }

    // 2. Crear mensaje de alerta
    const message = `
🚨 **ALERTA CRÍTICA: FALLO DE CRON JOB**

**Cron:** ${alert.cronName}
**Hora Esperada:** ${alert.expectedTime}
**Hora Actual:** ${alert.actualTime}
${alert.error ? `**Error:** ${alert.error}` : ''}

⚠️ **ACCIÓN REQUERIDA:**
El cron job NO se ejecutó automáticamente. Se requiere ejecución manual inmediata para evitar pérdida de datos.

**Pasos a seguir:**
1. Verificar logs de Vercel
2. Ejecutar manualmente el cierre de período
3. Verificar que el archivo histórico se creó correctamente
`.trim();

    // 3. Enviar notificación a CADA super_admin
    for (const admin of superAdmins) {
      try {
        await sendBotNotification(
          admin.id,
          'cron_failure_critical',
          message
        );
        
        console.log(`✅ [CRON-ALERT] Alerta enviada a ${admin.email}`);
      } catch (error) {
        console.error(`❌ [CRON-ALERT] Error enviando alerta a ${admin.email}:`, error);
      }
    }

    // 4. Registrar alerta en tabla de logs (si existe)
    await supabase.from('system_alerts').insert({
      alert_type: 'cron_failure',
      severity: 'critical',
      cron_name: alert.cronName,
      expected_time: alert.expectedTime,
      actual_time: alert.actualTime,
      error_message: alert.error,
      metadata: alert.metadata,
      notified_admins: superAdmins.map(a => a.id),
      created_at: new Date().toISOString()
    }).catch(err => {
      // Si la tabla no existe, solo log
      console.warn('⚠️ [CRON-ALERT] No se pudo registrar en system_alerts:', err.message);
    });

    console.log(`✅ [CRON-ALERT] Alerta enviada a ${superAdmins.length} super_admins`);

  } catch (error) {
    console.error('❌ [CRON-ALERT] Error crítico enviando alertas:', error);
    // NO lanzar excepción - las alertas no deben romper el flujo principal
  }
};

/**
 * Verifica si un cron se ejecutó a tiempo
 */
export const checkCronExecution = async (
  cronName: string,
  expectedDate: Date,
  toleranceMinutes: number = 15
): Promise<{ executed: boolean; latency?: number }> => {
  try {
    // Buscar registro de cierre en calculator_period_closure_status
    const [year, month, day] = [
      expectedDate.getFullYear(),
      expectedDate.getMonth() + 1,
      expectedDate.getDate()
    ];
    
    const periodDate = day <= 15 
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-${String(month).padStart(2, '0')}-16`;
    
    const periodType = day <= 15 ? '1-15' : '16-31';

    const { data: closureRecord, error } = await supabase
      .from('calculator_period_closure_status')
      .select('created_at, status')
      .eq('period_date', periodDate)
      .eq('period_type', periodType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !closureRecord) {
      console.warn(`⚠️ [CRON-CHECK] No se encontró registro de cierre para ${periodDate}`);
      return { executed: false };
    }

    const createdAt = new Date(closureRecord.created_at);
    const latencyMinutes = Math.floor((createdAt.getTime() - expectedDate.getTime()) / 60000);

    if (latencyMinutes > toleranceMinutes) {
      console.warn(`⚠️ [CRON-CHECK] Cron ${cronName} se ejecutó con ${latencyMinutes} minutos de retraso`);
    }

    return {
      executed: true,
      latency: latencyMinutes
    };

  } catch (error) {
    console.error('❌ [CRON-CHECK] Error verificando ejecución de cron:', error);
    return { executed: false };
  }
};

/**
 * Monitorea cron jobs críticos y envía alertas si fallan
 */
export const monitorCriticalCrons = async (): Promise<void> => {
  try {
    const now = new Date();
    const colombiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    
    const day = colombiaTime.getDate();
    const hour = colombiaTime.getHours();
    const minute = colombiaTime.getMinutes();

    // Solo verificar en días de cierre (1 y 16) y después de la hora esperada (00:15)
    if ((day === 1 || day === 16) && (hour > 0 || (hour === 0 && minute >= 15))) {
      console.log('🔍 [CRON-MONITOR] Verificando ejecución de cron de cierre...');
      
      const expectedTime = new Date(colombiaTime);
      expectedTime.setHours(0, 0, 0, 0);

      const result = await checkCronExecution('period-closure-full-close', expectedTime, 15);

      if (!result.executed) {
        await sendCronFailureAlert({
          cronName: 'period-closure-full-close',
          expectedTime: expectedTime.toISOString(),
          actualTime: colombiaTime.toISOString(),
          error: 'Cron no se ejecutó en el tiempo esperado (00:00 - 00:15 Colombia)',
          metadata: {
            day,
            hour,
            minute,
            checked_at: colombiaTime.toISOString()
          }
        });
      } else if (result.latency && result.latency > 5) {
        console.warn(`⚠️ [CRON-MONITOR] Cron se ejecutó con ${result.latency} minutos de retraso`);
      } else {
        console.log(`✅ [CRON-MONITOR] Cron ejecutado correctamente`);
      }
    }

  } catch (error) {
    console.error('❌ [CRON-MONITOR] Error en monitoreo de crons:', error);
  }
};
