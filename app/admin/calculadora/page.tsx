'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalculadoraHome() {
  const router = useRouter();

  useEffect(() => {
    // Redirigir automáticamente al dashboard
    router.push('/admin/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo al dashboard...</p>
      </div>
    </div>
  );
}


