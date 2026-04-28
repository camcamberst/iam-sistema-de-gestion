'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function PeriodClosureToolPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodDate, setPeriodDate] = useState('2024-11-16');
  const [periodType, setPeriodType] = useState<'16-31' | '1-15'>('16-31');
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userData?.role !== 'super_admin') {
        setError('Acceso denegado. Solo Super Admins pueden usar esta herramienta.');
      } else {
        setIsAdmin(true);
      }
    };
    checkUser();
  }, []);

  const handleClosePeriod = async () => {
    if (!confirm(`¿ESTÁS SEGURO? Esto cerrará forzosamente el periodo ${periodDate} (${periodType}), archivará los valores actuales y limpiará las calculadoras. Esta acción no se puede deshacer.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/calculator/period-closure/close-period', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'x-force-period-date': periodDate,
          'x-force-period-type': periodType
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido al cerrar periodo');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && !error) return <div className="p-8">Cargando...</div>;
  if (error) return <div className="p-8 text-red-600 font-bold">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-red-600">⚠️ Herramienta de Cierre Manual de Periodo</h1>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
        <p className="font-bold text-yellow-800">¡ADVERTENCIA!</p>
        <p className="text-yellow-700">
          Esta herramienta fuerza el cierre de un periodo, moviendo los datos de la calculadora al historial y borrándolos de la vista actual.
          Úsala SOLO cuando el cierre automático haya fallado.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Configuración del Cierre</h2>
        
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio del Periodo</label>
            <input 
              type="date" 
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">Ej: 2024-11-16 para la segunda quincena de Noviembre</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Periodo</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as any)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 focus:border-red-500"
            >
              <option value="1-15">Primera Quincena (1-15)</option>
              <option value="16-31">Segunda Quincena (16-31)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleClosePeriod}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-md text-white font-bold transition-colors ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-red-600 hover:bg-red-700 shadow-lg'
          }`}
        >
          {loading ? 'Procesando Cierre...' : 'EJECUTAR CIERRE MANUAL'}
        </button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-green-800 mb-2">✅ Cierre Exitoso</h3>
          <pre className="bg-gray-800 text-green-400 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

