import { redirect } from 'next/navigation';

export default function AnticiposRedirectPage() {
  // Redirigir por defecto a la pestaña de "Solicitar" dentro de finanzas/anticipos
  redirect('/admin/model/anticipos/solicitar');
}
