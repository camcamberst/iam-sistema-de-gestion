"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateUserPage() {
  const router = useRouter();

  // Redirigir automáticamente a la página de usuarios con el modal abierto
  useEffect(() => {
    // Redirigir a la página de usuarios con parámetro para abrir el modal
    router.push('/admin/users?create=true');
  }, [router]);

  // Mostrar mensaje de redirección mientras se redirige
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo al formulario de crear usuario...</p>
      </div>
    </div>
  );
}