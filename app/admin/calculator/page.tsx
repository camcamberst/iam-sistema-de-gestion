'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalculatorRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir a la página de configuración de calculadora
    router.replace('/admin/calculator/config');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo a la configuración de calculadora...</p>
      </div>
    </div>
  );
}
