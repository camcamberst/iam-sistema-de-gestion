"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Group {
  id: string;
  name: string;
}

interface HistoricalRate {
  id?: string;
  group_id: string;
  period_date: string;
  period_type: '1-15' | '16-31';
  rate_usd_cop: number;
  rate_eur_usd: number;
  rate_gbp_usd: number;
  aplicado_at?: string;
  aplicado_por?: string;
}

export default function GestorHistoricalRatesPage() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [rates, setRates] = useState<Record<string, HistoricalRate>>({});
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadRates();
    }
  }, [selectedGroup, selectedYear, selectedMonth]);

  const loadGroups = async () => {
    try {
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (groupsData) {
        setGroups(groupsData as Group[]);
        if (groupsData.length > 0 && !selectedGroup) {
          setSelectedGroup(groupsData[0].id);
        }
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  };

  const loadRates = async () => {
    if (!selectedGroup) return;

    try {
      setLoading(true);
      const periodDateP1 = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const periodDateP2 = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-16`;

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('No autenticado');
      }

      const response = await fetch(
        `/api/gestor/historical-rates?groupId=${selectedGroup}&year=${selectedYear}&month=${selectedMonth}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error cargando rates');
      }

      // Organizar rates por período
      const ratesMap: Record<string, HistoricalRate> = {};
      if (result.data) {
        result.data.forEach((rate: any) => {
          const key = `${rate.period_date}_${rate.period_type}`;
          ratesMap[key] = {
            id: rate.id,
            group_id: rate.group_id,
            period_date: rate.period_date,
            period_type: rate.period_type,
            rate_usd_cop: parseFloat(rate.rate_usd_cop),
            rate_eur_usd: parseFloat(rate.rate_eur_usd),
            rate_gbp_usd: parseFloat(rate.rate_gbp_usd),
            aplicado_at: rate.aplicado_at,
            aplicado_por: rate.aplicado_por
          };
        });
      }

      // Inicializar rates vacías si no existen
      const p1Key = `${periodDateP1}_1-15`;
      const p2Key = `${periodDateP2}_16-31`;
      
      if (!ratesMap[p1Key]) {
        ratesMap[p1Key] = {
          group_id: selectedGroup,
          period_date: periodDateP1,
          period_type: '1-15',
          rate_usd_cop: 3900,
          rate_eur_usd: 1.01,
          rate_gbp_usd: 1.20
        };
      }
      
      if (!ratesMap[p2Key]) {
        ratesMap[p2Key] = {
          group_id: selectedGroup,
          period_date: periodDateP2,
          period_type: '16-31',
          rate_usd_cop: 3900,
          rate_eur_usd: 1.01,
          rate_gbp_usd: 1.20
        };
      }

      setRates(ratesMap);
    } catch (error: any) {
      console.error('Error cargando rates:', error);
      setMessage({ type: 'error', text: error.message || 'Error cargando rates históricas' });
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = (periodType: '1-15' | '16-31', field: 'rate_usd_cop' | 'rate_eur_usd' | 'rate_gbp_usd', value: string) => {
    const periodDate = periodType === '1-15'
      ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-16`;
    
    const key = `${periodDate}_${periodType}`;
    setRates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        group_id: selectedGroup,
        period_date: periodDate,
        period_type: periodType,
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const saveRates = async (periodType: '1-15' | '16-31') => {
    if (!selectedGroup) {
      setMessage({ type: 'error', text: 'Por favor selecciona un grupo' });
      return;
    }

    try {
      setSaving(true);
      const periodDate = periodType === '1-15'
        ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
        : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-16`;
      
      const key = `${periodDate}_${periodType}`;
      const rate = rates[key];

      if (!rate) {
        throw new Error('Rate no encontrada');
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('No autenticado');
      }

      const response = await fetch('/api/gestor/historical-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          groupId: rate.group_id,
          periodDate: rate.period_date,
          periodType: rate.period_type,
          rateUsdCop: rate.rate_usd_cop,
          rateEurUsd: rate.rate_eur_usd,
          rateGbpUsd: rate.rate_gbp_usd
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error guardando rates');
      }

      setMessage({ type: 'success', text: `Rates de ${periodType} guardadas correctamente` });
      setTimeout(() => setMessage(null), 3000);
      await loadRates(); // Recargar para obtener el ID si es nuevo
    } catch (error: any) {
      console.error('Error guardando rates:', error);
      setMessage({ type: 'error', text: error.message || 'Error guardando rates históricas' });
    } finally {
      setSaving(false);
    }
  };

  const applyRates = async (periodType: '1-15' | '16-31') => {
    if (!selectedGroup) {
      setMessage({ type: 'error', text: 'Por favor selecciona un grupo' });
      return;
    }

    if (!confirm(`¿Estás seguro de aplicar las rates de ${periodType}? Esto recalculará todos los valores históricos de este período.`)) {
      return;
    }

    try {
      setApplying(true);
      const periodDate = periodType === '1-15'
        ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
        : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-16`;

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('No autenticado');
      }

      const response = await fetch('/api/gestor/historical-rates/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          groupId: selectedGroup,
          periodDate,
          periodType
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error aplicando rates');
      }

      setMessage({ 
        type: 'success', 
        text: `Rates aplicadas correctamente. ${result.data?.updatedCount || 0} registros actualizados.` 
      });
      setTimeout(() => setMessage(null), 5000);
      await loadRates(); // Recargar para ver el estado de aplicación
    } catch (error: any) {
      console.error('Error aplicando rates:', error);
      setMessage({ type: 'error', text: error.message || 'Error aplicando rates históricas' });
    } finally {
      setApplying(false);
    }
  };

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const periodDateP1 = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const periodDateP2 = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-16`;
  const p1Key = `${periodDateP1}_1-15`;
  const p2Key = `${periodDateP2}_16-31`;
  const p1Rate = rates[p1Key];
  const p2Rate = rates[p2Key];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-gray-400 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Configurar Rates Históricas
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configura rates históricas para recalcular períodos pasados. Estas rates SOLO afectan a períodos históricos.
          </p>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Grupo/Sede
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Seleccionar grupo</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Año
              </label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="2020"
                max={new Date().getFullYear()}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mes
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {months.map((month, index) => (
                  <option key={index + 1} value={index + 1}>{month}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedGroup && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Período 1 (1-15) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Período 1 (1-15)
                </h2>
                {p1Rate?.aplicado_at && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                    Aplicado
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    USD → COP
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={p1Rate?.rate_usd_cop || ''}
                    onChange={(e) => handleRateChange('1-15', 'rate_usd_cop', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    EUR → USD
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={p1Rate?.rate_eur_usd || ''}
                    onChange={(e) => handleRateChange('1-15', 'rate_eur_usd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GBP → USD
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={p1Rate?.rate_gbp_usd || ''}
                    onChange={(e) => handleRateChange('1-15', 'rate_gbp_usd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => saveRates('1-15')}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    {saving ? 'Guardando...' : 'Guardar Rates'}
                  </button>
                  <button
                    onClick={() => applyRates('1-15')}
                    disabled={applying || !p1Rate?.id}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    {applying ? 'Aplicando...' : 'Aplicar Rates'}
                  </button>
                </div>
              </div>
            </div>

            {/* Período 2 (16-31) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Período 2 (16-31)
                </h2>
                {p2Rate?.aplicado_at && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                    Aplicado
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    USD → COP
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={p2Rate?.rate_usd_cop || ''}
                    onChange={(e) => handleRateChange('16-31', 'rate_usd_cop', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    EUR → USD
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={p2Rate?.rate_eur_usd || ''}
                    onChange={(e) => handleRateChange('16-31', 'rate_eur_usd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    GBP → USD
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={p2Rate?.rate_gbp_usd || ''}
                    onChange={(e) => handleRateChange('16-31', 'rate_gbp_usd', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => saveRates('16-31')}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    {saving ? 'Guardando...' : 'Guardar Rates'}
                  </button>
                  <button
                    onClick={() => applyRates('16-31')}
                    disabled={applying || !p2Rate?.id}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    {applying ? 'Aplicando...' : 'Aplicar Rates'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Información importante */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>⚠️ Importante:</strong> Las rates históricas SOLO afectan a períodos pasados en <code>calculator_history</code>. 
            NO afectan a rates actuales ni a períodos en curso. Al hacer clic en "Aplicar Rates", se recalcularán todos los valores 
            históricos del período seleccionado usando estas rates.
          </p>
        </div>
      </div>
    </div>
  );
}

