"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isWithinSavingsWindow } from '@/lib/savings/savings-utils';
import AppleDropdown from '@/components/ui/AppleDropdown';
import InfoCard from '@/components/ui/InfoCard';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Period {
  period_date: string;
  period_type: '1-15' | '16-31';
  neto_pagar: number;
  total_cop_modelo: number;
  total_anticipos: number;
  total_deducciones: number;
}

interface ExistingSavings {
  id: string;
  estado: string;
  monto_ahorrado: number;
  porcentaje_ahorrado: number;
}

export default function SolicitarAhorroPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Períodos disponibles
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [existingSavings, setExistingSavings] = useState<ExistingSavings | null>(null);
  const [netoPagar, setNetoPagar] = useState<number | null>(null);
  const [loadingNeto, setLoadingNeto] = useState(false);
  
  // Datos del ahorro
  const [tipoSolicitud, setTipoSolicitud] = useState<'monto' | 'porcentaje'>('monto');
  const [montoAhorrado, setMontoAhorrado] = useState<string>('');
  const [porcentajeAhorrado, setPorcentajeAhorrado] = useState<string>('');
  
  // Validación de ventana
  const [windowInfo, setWindowInfo] = useState<{ isWithin: boolean; reason?: string; windowStart?: string; windowEnd?: string } | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      checkWindowAndLoadNeto();
    }
  }, [selectedPeriod]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      if (!userData || userData.role !== 'modelo') {
        router.push('/login');
        return;
      }

      setUser(userData);
      await loadPeriods(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadPeriods = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      // Obtener períodos del historial
      const response = await fetch(`/api/model/calculator/historial?modelId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success) {
        // Filtrar períodos con neto_pagar > 0
        const availablePeriods = (data.periods || []).filter((p: any) => 
          p.neto_pagar && p.neto_pagar > 0
        );
        setPeriods(availablePeriods);
      }
    } catch (error) {
      console.error('Error loading periods:', error);
    }
  };

  const checkWindowAndLoadNeto = async () => {
    if (!selectedPeriod || !user) return;

    // Validar ventana de tiempo
    const windowCheck = isWithinSavingsWindow(
      selectedPeriod.period_date,
      selectedPeriod.period_type
    );
    setWindowInfo(windowCheck);

    if (windowCheck.isWithin) {
      // Cargar NETO A PAGAR y verificar si ya hay solicitud
      setLoadingNeto(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        // Obtener NETO A PAGAR
        setNetoPagar(selectedPeriod.neto_pagar);

        // Verificar si ya existe una solicitud
        const savingsResponse = await fetch(
          `/api/model/savings?modelId=${user.id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const savingsData = await savingsResponse.json();

        if (savingsData.success) {
          const existing = (savingsData.savings || []).find((s: any) =>
            s.period_date === selectedPeriod.period_date &&
            s.period_type === selectedPeriod.period_type
          );
          setExistingSavings(existing || null);
        }
      } catch (error) {
        console.error('Error loading neto:', error);
      } finally {
        setLoadingNeto(false);
      }
    }
  };

  const handleMontoChange = (value: string) => {
    setMontoAhorrado(value);
    if (netoPagar && value) {
      const monto = parseFloat(value.replace(/[^\d]/g, ''));
      if (!isNaN(monto) && monto > 0) {
        const porcentaje = (monto / netoPagar) * 100;
        setPorcentajeAhorrado(porcentaje.toFixed(2));
      }
    }
  };

  const handlePorcentajeChange = (value: string) => {
    setPorcentajeAhorrado(value);
    if (netoPagar && value) {
      const porcentaje = parseFloat(value.replace(/[^\d.]/g, ''));
      if (!isNaN(porcentaje) && porcentaje > 0) {
        const monto = (netoPagar * porcentaje) / 100;
        setMontoAhorrado(Math.round(monto).toString());
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriod || !user || !windowInfo?.isWithin) {
      setError('Por favor selecciona un período válido dentro de la ventana de tiempo');
      return;
    }

    if (!netoPagar || netoPagar <= 0) {
      setError('No hay fondos disponibles para ahorrar en este período');
      return;
    }

    // Validar que se haya ingresado un valor
    if (tipoSolicitud === 'monto' && (!montoAhorrado || parseFloat(montoAhorrado.replace(/[^\d]/g, '')) <= 0)) {
      setError('Por favor ingresa un monto válido');
      return;
    }

    if (tipoSolicitud === 'porcentaje' && (!porcentajeAhorrado || parseFloat(porcentajeAhorrado.replace(/[^\d.]/g, '')) <= 0)) {
      setError('Por favor ingresa un porcentaje válido');
      return;
    }

    const monto = tipoSolicitud === 'monto' 
      ? parseFloat(montoAhorrado.replace(/[^\d]/g, ''))
      : (netoPagar * parseFloat(porcentajeAhorrado.replace(/[^\d.]/g, ''))) / 100;
    
    const porcentaje = tipoSolicitud === 'porcentaje'
      ? parseFloat(porcentajeAhorrado.replace(/[^\d.]/g, ''))
      : (monto / netoPagar) * 100;

    // Validaciones de límites
    const MIN_AHORRO = 50000;
    const MAX_PORCENTAJE = 90;

    if (monto < MIN_AHORRO) {
      setError(`El monto mínimo de ahorro es ${formatCurrency(MIN_AHORRO)}`);
      return;
    }

    if (porcentaje > MAX_PORCENTAJE) {
      setError(`El porcentaje máximo permitido es ${MAX_PORCENTAJE}%`);
      return;
    }

    if (monto > netoPagar) {
      setError(`El monto a ahorrar no puede ser mayor al NETO A PAGAR (${formatCurrency(netoPagar)})`);
      return;
    }

    // Confirmación antes de enviar
    const confirmMessage = `¿Confirmas que deseas solicitar ahorrar ${formatCurrency(monto)} (${porcentaje.toFixed(2)}%) del período ${selectedPeriod.period_type === '1-15' ? 'P1' : 'P2'}?`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        setSubmitting(false);
        return;
      }

      const response = await fetch('/api/model/savings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period_date: selectedPeriod.period_date,
          period_type: selectedPeriod.period_type,
          monto_ahorrado: tipoSolicitud === 'monto' ? monto : undefined,
          porcentaje_ahorrado: tipoSolicitud === 'porcentaje' ? porcentaje : undefined,
          tipo_solicitud: tipoSolicitud
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/admin/model/finanzas/ahorro');
        }, 2000);
      } else {
        setError(data.error || 'Error al crear solicitud');
      }
    } catch (error: any) {
      console.error('Error submitting:', error);
      setError(error.message || 'Error al procesar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Solicitar Ahorro
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Solicita ahorrar parte de tu facturación de un período cerrado
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-700 font-medium">
                Solicitud de ahorro creada exitosamente. Redirigiendo...
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-2">
            <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Seleccionar Período */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Período Cerrado *
                  </label>
                  <AppleDropdown
                    options={periods.map(p => ({
                      value: `${p.period_date}-${p.period_type}`,
                      label: `${new Date(p.period_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })} (${p.period_type === '1-15' ? 'P1' : 'P2'})`
                    }))}
                    value={selectedPeriod ? `${selectedPeriod.period_date}-${selectedPeriod.period_type}` : ''}
                    onChange={(value) => {
                      const [date, type] = value.split('-');
                      const period = periods.find(p => p.period_date === date && p.period_type === type);
                      setSelectedPeriod(period || null);
                      setMontoAhorrado('');
                      setPorcentajeAhorrado('');
                      setExistingSavings(null);
                    }}
                    placeholder="Selecciona un período"
                  />
                </div>

                {/* Información de ventana de tiempo */}
                {selectedPeriod && windowInfo && (
                  <div className={`p-4 rounded-lg border ${
                    windowInfo.isWithin
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {windowInfo.isWithin ? (
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      )}
                      <div>
                        <p className={`text-sm font-medium ${
                          windowInfo.isWithin
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-yellow-700 dark:text-yellow-300'
                        }`}>
                          {windowInfo.isWithin
                            ? '✅ Ventana de ahorro activa'
                            : windowInfo.reason || 'Ventana de ahorro cerrada'}
                        </p>
                        {windowInfo.windowStart && windowInfo.windowEnd && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Ventana: {new Date(windowInfo.windowStart).toLocaleDateString('es-CO')} - {new Date(windowInfo.windowEnd).toLocaleDateString('es-CO')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* NETO A PAGAR */}
                {selectedPeriod && netoPagar !== null && (
                  <InfoCard
                    label="NETO A PAGAR del Período"
                    value={formatCurrency(netoPagar)}
                    color="blue"
                  />
                )}

                {/* Solicitud existente */}
                {existingSavings && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                      Ya tienes una solicitud {existingSavings.estado === 'pendiente' ? 'pendiente' : existingSavings.estado} para este período.
                    </p>
                    {existingSavings.estado === 'pendiente' && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        Puedes editar el monto antes de que sea aprobada.
                      </p>
                    )}
                  </div>
                )}

                {/* Tipo de solicitud */}
                {selectedPeriod && windowInfo?.isWithin && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Tipo de Solicitud *
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setTipoSolicitud('monto');
                            setPorcentajeAhorrado('');
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                            tipoSolicitud === 'monto'
                              ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'
                              : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Monto en COP
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTipoSolicitud('porcentaje');
                            setMontoAhorrado('');
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                            tipoSolicitud === 'porcentaje'
                              ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'
                              : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                          }`}
                        >
                          Porcentaje
                        </button>
                      </div>
                    </div>

                    {/* Campo según tipo */}
                    {tipoSolicitud === 'monto' ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          Monto a Ahorrar (COP) *
                        </label>
                        <input
                          type="text"
                          value={montoAhorrado}
                          onChange={(e) => handleMontoChange(e.target.value)}
                          placeholder="Ej: 1000000"
                          className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                          required
                        />
                        {montoAhorrado && netoPagar && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Equivale al {((parseFloat(montoAhorrado.replace(/[^\d]/g, '')) / netoPagar) * 100).toFixed(2)}% del NETO A PAGAR
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Mínimo: $50,000 COP | Máximo: 90% del NETO A PAGAR
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          Porcentaje a Ahorrar (%) *
                        </label>
                        <input
                          type="text"
                          value={porcentajeAhorrado}
                          onChange={(e) => handlePorcentajeChange(e.target.value)}
                          placeholder="Ej: 50"
                          className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                          required
                        />
                        {porcentajeAhorrado && netoPagar && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Equivale a {formatCurrency((netoPagar * parseFloat(porcentajeAhorrado.replace(/[^\d.]/g, ''))) / 100)} COP
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Mínimo: 1% (equivalente a $50,000) | Máximo: 90%
                        </p>
                      </div>
                    )}

                    {/* Botón de envío */}
                    <button
                      type="submit"
                      disabled={submitting || !windowInfo.isWithin || loadingNeto}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Enviando...' : existingSavings?.estado === 'pendiente' ? 'Actualizar Solicitud' : 'Solicitar Ahorro'}
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>

          {/* Información lateral */}
          <div className="space-y-6">
            <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Información Importante
              </h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    <strong>Ventana de tiempo:</strong> Puedes solicitar ahorro solo durante 3 días después del cierre del período (días 16-18 para P1, días 1-3 para P2).
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    <strong>Límites:</strong> Mínimo $50,000 COP, máximo 90% del NETO A PAGAR.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p>
                    <strong>Aprobación:</strong> Tu solicitud será revisada por un administrador antes de ser aprobada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
