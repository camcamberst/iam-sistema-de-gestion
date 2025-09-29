"use client";

import Link from "next/link";

export default function CalculadoraHome() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Gestionar Calculadora</h1>
        <p className="text-gray-500 mb-6">Base para futuras funciones de la calculadora.</p>

        <div className="apple-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Próximamente</h2>
          <p className="text-sm text-gray-500">Aquí construiremos las subopciones que definamos.</p>
          <div className="mt-4">
            <Link href="/admin/dashboard" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100">Volver al dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}


