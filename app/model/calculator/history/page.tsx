'use client';

import { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { getCalculatorDate } from '@/utils/calculator-dates';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'modelo';
  groups: string[];
  organization_id: string;
  is_active: boolean;
  last_login: string;
}

interface HistoricalValue {
  id: string;
  platform_id: string;
  value: number;
  period_date: string;
  period_type: '1-15' | '16-31';
  archived_at: string;
  original_updated_at: string;
}

interface HistoricalPeriod {
  period_date: string;
  period_type: '1-15' | '16-31';
  values: HistoricalValue[];
  total_value: number;
}

export default function CalculatorHistory() {
  const [user, setUser] = useState<User | null>(null);
  const [historicalPeriods, setHistoricalPeriods] = useState<HistoricalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // Load current user
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) {
          setUser(null);
          setLoading(false);
          return;
        }
        
        const { data: userRow } = await supabase
          .from('users')
          .select('id,name,email,role')
          .eq('id', uid)
          .single();
        
        let groups: string[] = [];
        if (userRow && userRow.role !== 'super_admin') {
          const { data: ug } = await supabase
            .from('user_groups')
            .select('groups(name)')
            .eq('user_id', uid);
          groups = (ug || []).map((r: any) => r.groups?.name).filter(Boolean);
        }
        
        const current = {
          id: userRow?.id || uid,
          name: userRow?.name || auth.user?.email?.split('@')[0] || 'Usuario',
          email: userRow?.email || auth.user?.email || '',
          role: (userRow?.role as any) || 'modelo',
          groups,
          organization_id: '',
          is_active: true,
          last_login: new Date().toISOString(),
        };
        
        setUser(current);
        
        // Load historical data
        await loadHistoricalData(uid);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Error cargando datos');
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, []);

  const loadHistoricalData = async (userId: string) => {
    try {
      const { data: history, error } = await supabase
        .from('calculator_history')
        .select('*')
        .eq('model_id', userId)
        .order('period_date', { ascending: false })
        .order('archived_at', { ascending: false });
      
      if (error) {
        console.error('Error loading history:', error);
        setError('Error cargando historial');
        return;
      }
      
      // Agrupar por período
      const groupedData = new Map<string, HistoricalPeriod>();
      
      history?.forEach((item: any) => {
        const key = `${item.period_date}-${item.period_type}`;
        
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            period_date: item.period_date,
            period_type: item.period_type,
            values: [],
            total_value: 0
          });
        }
        
        const period = groupedData.get(key)!;
        period.values.push({
          id: item.id,
          platform_id: item.platform_id,
          value: item.value,
          period_date: item.period_date,
          period_type: item.period_type,
          archived_at: item.archived_at,
          original_updated_at: item.original_updated_at
        });
        period.total_value += item.value;
      });
      
      setHistoricalPeriods(Array.from(groupedData.values()));
      
    } catch (error) {
      console.error('Error loading historical data:', error);
      setError('Error cargando datos históricos');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'modelo') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">Solo las modelos pueden acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mb-2">Mi Historial de Calculadora</h1>
              <p className="text-gray-500 text-sm">
                Valores archivados de períodos anteriores
              </p>
            </div>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              Regresar
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Historical Periods */}
        {historicalPeriods.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay historial disponible</h3>
            <p className="text-gray-500 text-sm">
              Los valores se archivan automáticamente al final de cada período
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {historicalPeriods.map((period, index) => (
              <div key={`${period.period_date}-${period.period_type}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Período {period.period_type === '1-15' ? '1' : '2'} - {formatDate(period.period_date)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {period.values.length} plataforma{period.values.length !== 1 ? 's' : ''} registrada{period.values.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(period.total_value)}
                    </p>
                    <p className="text-sm text-gray-500">Total del período</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {period.values.map((value) => (
                    <div key={value.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 capitalize">
                          {value.platform_id.replace('_', ' ')}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {formatCurrency(value.value)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Archivado: {new Date(value.archived_at).toLocaleDateString('es-CO')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
