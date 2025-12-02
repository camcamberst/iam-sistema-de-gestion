import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente de Resend solo si existe la API Key
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Inicializar Supabase para buscar destinatarios
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Usar service key para saltar RLS
const supabase = createClient(supabaseUrl, supabaseKey);

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Función genérica para enviar correos usando Resend
 */
export async function sendEmail({ to, subject, html }: EmailPayload) {
  if (!resend) {
    console.warn('⚠️ [EMAIL] No se ha configurado RESEND_API_KEY. El correo no se enviará.');
    return { success: false, error: 'Configuration missing' };
  }

  try {
    const fromEmail = process.env.EMAIL_FROM || 'Sistema de Gestión <onboarding@resend.dev>';
    
    // Convertir a array si es string
    const recipients = Array.isArray(to) ? to : [to];
    
    if (recipients.length === 0) {
      console.warn('⚠️ [EMAIL] No hay destinatarios para enviar el correo.');
      return { success: false, error: 'No recipients' };
    }

    const data = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html,
    });
    
    console.log(`✅ [EMAIL] Correo enviado a ${recipients.length} destinatario(s). ID: ${data.data?.id}`);
    return { success: true, data };
  } catch (error) {
    console.error('❌ [EMAIL] Error enviando correo:', error);
    return { success: false, error };
  }
}

/**
 * Obtiene los correos de los admins relevantes para una modelo específica
 * - Super Admins: Siempre reciben todas las notificaciones
 * - Admins: Solo reciben si comparten grupo con la modelo
 */
async function getRelevantAdminEmails(modelId: string): Promise<string[]> {
  try {
    // 1. Obtener Super Admins (siempre reciben todo)
    const { data: superAdmins } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    const superAdminEmails = superAdmins?.map(u => u.email).filter((email): email is string => !!email) || [];

    // 2. Obtener grupos de la modelo
    const { data: modelGroups } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', modelId);
    
    const groupIds = modelGroups?.map(g => g.group_id) || [];
    let groupAdminEmails: string[] = [];

    // 3. Si la modelo tiene grupos, buscar admins asignados a esos grupos
    if (groupIds.length > 0) {
      const { data: groupAdmins } = await supabase
        .from('user_groups')
        .select(`
          users!inner (
            email,
            role,
            is_active
          )
        `)
        .in('group_id', groupIds)
        .eq('users.role', 'admin') // Filtrar explícitamente rol admin (los super ya los tenemos)
        .eq('users.is_active', true);
      
      // Mapeo seguro accediendo a la relación users
      groupAdminEmails = groupAdmins?.map((ga: any) => ga.users?.email).filter((email): email is string => !!email) || [];
    }

    // 4. Combinar listas y eliminar duplicados
    const allEmails = Array.from(new Set([...superAdminEmails, ...groupAdminEmails]));

    console.log(`🔍 [EMAIL] Modelo ${modelId} pertenece a grupos [${groupIds.join(',')}]. Se notificará a ${allEmails.length} admins.`);
    return allEmails;
  } catch (err) {
    console.error('❌ [EMAIL] Error inesperado buscando admins relevantes:', err);
    return [];
  }
}

/**
 * Notifica a los administradores correspondientes sobre una nueva solicitud de anticipo
 */
export async function notifyNewAnticipo(data: {
  modelName: string;
  amount: number;
  requestId: string;
  paymentMethod: string;
  modelId: string;
}) {
  // 1. Obtener lista filtrada de correos (Super Admins + Admins del grupo)
  const adminEmails = await getRelevantAdminEmails(data.modelId);
  
  // Agregar email de fallback del .env si existe y no está en la lista (generalmente para debug o super-super-admin oculto)
  const envAdminEmail = process.env.ADMIN_EMAIL_NOTIFICATIONS;
  if (envAdminEmail && !adminEmails.includes(envAdminEmail)) {
    adminEmails.push(envAdminEmail);
  }

  if (adminEmails.length === 0) {
    console.warn('⚠️ [EMAIL] No se encontraron administradores para notificar.');
    return;
  }

  const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  });

  const formattedAmount = currencyFormatter.format(data.amount);
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/anticipos?id=${data.requestId}`;
  
  // Mapear método de pago a nombre legible
  const paymentMethodMap: Record<string, string> = {
    'nequi': 'Nequi',
    'daviplata': 'DaviPlata',
    'cuenta_bancaria': 'Cuenta Bancaria'
  };
  const readablePaymentMethod = paymentMethodMap[data.paymentMethod] || data.paymentMethod;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #2563eb; text-align: center; margin-bottom: 24px;">💰 Nueva Solicitud de Anticipo</h2>
      
      <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
        <p style="margin: 8px 0; font-size: 16px;"><strong>Modelo:</strong> <span style="color: #1e293b;">${data.modelName}</span></p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>Monto Solicitado:</strong> <span style="font-size: 1.2em; color: #16a34a; font-weight: bold;">${formattedAmount}</span></p>
        <p style="margin: 8px 0; font-size: 16px;"><strong>Medio de Pago:</strong> <span style="color: #1e293b;">${readablePaymentMethod}</span></p>
      </div>

      <p style="color: #475569; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
        Se ha registrado una nueva solicitud que requiere tu revisión. Ingresa al panel administrativo para aprobarla o rechazarla.
      </p>

      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${dashboardUrl}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
          Ver Solicitud en el Panel
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        Este es un mensaje automático del Sistema de Gestión.
      </p>
    </div>
  `;

  // Resend permite enviar a múltiples destinatarios en el campo 'to' (array)
  return sendEmail({
    to: adminEmails,
    subject: `🔔 Solicitud de Anticipo: ${data.modelName} - ${formattedAmount}`,
    html: htmlContent
  });
}


