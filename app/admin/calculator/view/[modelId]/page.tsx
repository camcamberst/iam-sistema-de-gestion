'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseAdminClient } from '@/lib/supabase-singleton';
import { getCalculatorDate } from '@/utils/calculator-dates';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  value: number;
  percentage: number;
  currency: string;
}

interface CalculatorData {
  platforms: Platform[];
  rates: {
    usd_cop: number;
    eur_usd: number;
    gbp_usd: number;
  };
  totalValue: number;
  totalCOP: number;
}

export default function AdminCalculatorViewPage({ params }: { params: { modelId: string } }) {
  const [user, setUser] = useState<User | null>(null);
  const [model, setModel] = useState<User | null>(null);
  const [calculatorData, setCalculatorData] = useState<CalculatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const supabaseAdmin = getSupabaseAdminClient();

  useEffect(() => {
    loadData();
  }, [params.modelId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Verificar que el usuario actual es admin/super_admin
      const { data: auth } = await supabaseAdmin.auth.getUser();
      if (!auth?.user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        router.push('/login');
        return;
      }

      setUser(userData);

      // 2. Obtener datos de la modelo
      const { data: modelData } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role')
        .eq('id', params.modelId)
        .single();

      if (!modelData || modelData.role !== 'modelo') {
        setError('Modelo no encontrada');
        return;
      }

      setModel(modelData);

      // 3. Cargar configuración de calculadora
      const { data: config } = await supabaseAdmin
        .from('calculator_config')
        .select('*')
        .eq('model_id', params.modelId)
        .eq('active', true)
        .single();

      if (!config) {
        setError('La modelo no tiene configuración de calculadora');
        return;
      }

      // 4. Cargar valores del modelo
      const periodDate = getCalculatorDate();
      const { data: values } = await supabaseAdmin
        .from('model_values')
        .select('*')
        .eq('model_id', params.modelId)
        .eq('period_date', periodDate);

      // 5. Cargar tasas
      const { data: rates } = await supabaseAdmin
        .from('rates')
        .select('*')
        .eq('active', true);

      // 6. Cargar plataformas
      const { data: platforms } = await supabaseAdmin
        .from('calculator_platforms')
        .select('*')
        .eq('active', true);

      if (!platforms) {
        setError('No hay plataformas configuradas');
        return;
      }

      // 7. Procesar datos
      const ratesMap = new Map(rates?.map(r => [r.kind, r.value]) || []);
      const valuesMap = new Map(values?.map(v => [v.platform_id, v.value]) || []);

      const processedPlatforms: Platform[] = platforms.map(platform => ({
        id: platform.id,
        name: platform.name,
        enabled: config.enabled_platforms?.includes(platform.id) || false,
        value: valuesMap.get(platform.id) || 0,
        percentage: config.percentage_override || config.group_percentage || 80,
        currency: platform.currency || 'USD'
      }));

      // 8. Calcular totales
      let totalValue = 0;
      let totalCOP = 0;

      processedPlatforms.forEach(platform => {
        if (platform.enabled && platform.value > 0) {
          let usdValue = 0;

          if (platform.currency === 'EUR') {
            usdValue = platform.value * (ratesMap.get('EUR→USD') || 1.01);
          } else if (platform.currency === 'GBP') {
            usdValue = platform.value * (ratesMap.get('GBP→USD') || 1.20);
          } else {
            usdValue = platform.value;
          }

          const modelValue = usdValue * (platform.percentage / 100);
          totalValue += modelValue;
        }
      });

      totalCOP = totalValue * (ratesMap.get('USD→COP') || 3900);

      setCalculatorData({
        platforms: processedPlatforms,
        rates: {
          usd_cop: ratesMap.get('USD→COP') || 3900,
          eur_usd: ratesMap.get('EUR→USD') || 1.01,
          gbp_usd: ratesMap.get('GBP→USD') || 1.20
        },
        totalValue,
        totalCOP
      });

    } catch (error) {
      console.error('Error loading calculator data:', error);
      setError('Error al cargar datos de la calculadora');
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformChange = async (platformId: string, value: number) => {
    if (!calculatorData) return;

    try {
      setSaving(true);

      // Actualizar estado local
      setCalculatorData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          platforms: prev.platforms.map(p => 
            p.id === platformId ? { ...p, value } : p
          )
        };
      });

      // Guardar en base de datos
      const periodDate = getCalculatorDate();
      const { error } = await supabaseAdmin
        .from('model_values')
        .upsert({
          model_id: params.modelId,
          platform_id: platformId,
          value: value,
          period_date: periodDate
        });

      if (error) {
        console.error('Error saving value:', error);
        // Revertir cambio local
        setCalculatorData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            platforms: prev.platforms.map(p => 
              p.id === platformId ? { ...p, value: p.value } : p
            )
          };
        });
      }

    } catch (error) {
      console.error('Error updating platform value:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePlatformToggle = async (platformId: string, enabled: boolean) => {
    if (!calculatorData) return;

    try {
      setSaving(true);

      // Actualizar estado local
      setCalculatorData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          platforms: prev.platforms.map(p => 
            p.id === platformId ? { ...p, enabled } : p
          )
        };
      });

      // Guardar configuración
      const { error } = await supabaseAdmin
        .from('calculator_config')
        .update({
          enabled_platforms: calculatorData.platforms
            .filter(p => p.id === platformId ? enabled : p.enabled)
            .filter(p => p.enabled)
            .map(p => p.id)
        })
        .eq('model_id', params.modelId)
        .eq('active', true);

      if (error) {
        console.error('Error updating platform config:', error);
        // Revertir cambio local
        setCalculatorData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            platforms: prev.platforms.map(p => 
              p.id === platformId ? { ...p, enabled: !enabled } : p
            )
          };
        });
      }

    } catch (error) {
      console.error('Error updating platform config:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando calculadora...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 rounded-xl border border-red-200">
          <h1 className="text-2xl font-semibold text-red-800 mb-4">Error</h1>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => router.push('/admin/calculator/view-model')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!calculatorData || !model) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-6 bg-yellow-50 rounded-xl border border-yellow-200">
          <h1 className="text-2xl font-semibold text-yellow-800 mb-4">No hay datos</h1>
          <p className="text-yellow-700">No se pudieron cargar los datos de la calculadora</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Calculadora de {model.name}
              </h1>
              <p className="text-gray-600">
                Vista de administrador - Puedes editar los valores ingresados por la modelo
              </p>
            </div>
            <button
              onClick={() => router.push('/admin/calculator/view-model')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Volver
            </button>
          </div>
        </div>

        {/* Tasas */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Tasas Actualizadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">
                ${calculatorData.rates.usd_cop.toLocaleString()} USD→COP
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-900">
                {calculatorData.rates.eur_usd} EUR→USD
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">
                {calculatorData.rates.gbp_usd} GBP→USD
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Configuradas por tu administrador</p>
        </div>

        {/* Calculadora */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Calculadora de Ingresos</h2>
          
          <div className="space-y-4">
            {calculatorData.platforms.map((platform) => (
              <div key={platform.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={platform.enabled}
                    onChange={(e) => handlePlatformToggle(platform.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900">{platform.name}</span>
                </div>
                
                {platform.enabled && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={platform.value}
                      onChange={(e) => handlePlatformChange(platform.id, parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-500">{platform.currency}</span>
                    <span className="text-sm text-gray-500">({platform.percentage}%)</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total USD:</span>
              <span className="text-xl font-bold text-blue-900">
                ${calculatorData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-semibold text-gray-900">Total COP:</span>
              <span className="text-xl font-bold text-green-900">
                ${calculatorData.totalCOP.toLocaleString('es-CO')}
              </span>
            </div>
          </div>
        </div>

        {/* Estado de guardado */}
        {saving && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Guardando...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
