"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { calculateProcessingTime } from '@/lib/savings/savings-window';
import AppleDropdown from '@/components/ui/AppleDropdown';
import InfoCard from '@/components/ui/InfoCard';
import PageHeader from '@/components/ui/PageHeader';
import GlassCard from '@/components/ui/GlassCard';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';
import AppleButton from '@/components/ui/AppleButton';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface WithdrawalData {
  monto_solicitado: number;
  medio_pago: 'nequi' | 'daviplata' | 'cuenta_bancaria';
  nombre_beneficiario?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  banco?: string;
  banco_otro?: string;
  tipo_cuenta?: 'ahorros' | 'corriente';
  numero_cuenta?: string;
  documento_titular?: string;
}

export default function SolicitarRetiroPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Saldo disponible
  const [balance, setBalance] = useState<{ saldo_actual: number } | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  
  // Datos del retiro
  const [withdrawalData, setWithdrawalData] = useState<WithdrawalData>({
    monto_solicitado: 0,
    medio_pago: 'nequi'
  });
  
  // Estados para validación y formato
  const [montoError, setMontoError] = useState('');
  const [montoFormatted, setMontoFormatted] = useState('');
  const [telefonoError, setTelefonoError] = useState('');
  const [processingInfo, setProcessingInfo] = useState<{ tiempo: string; fechaEstimada: Date; porcentaje: number } | null>(null);

  const router = useRouter();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    // Inicializar supabase solo en el cliente
    if (typeof window !== 'undefined') {
      const { supabase: supabaseClient } = require('@/lib/supabase');
      setSupabase(supabaseClient);
    }
  }, []);

  // Lista de bancos de Colombia
  const bancosColombia = [
    'Bancolombia',
    'Banco de Bogotá',
    'BBVA Colombia',
    'Davivienda',
    'Colpatria',
    'Banco Popular',
    'Banco AV Villas',
    'Banco Caja Social',
    'Banco Falabella',
    'Banco Santander',
    'Banco de Occidente',
    'Otros'
  ];

  // Opciones de tipo de cuenta
  const tiposCuenta = ['Ahorros', 'Corriente'];

  useEffect(() => {
    if (supabase) {
      loadUser();
    }
  }, [supabase]);

  useEffect(() => {
    if (withdrawalData.monto_solicitado > 0 && balance) {
      const processing = calculateProcessingTime(withdrawalData.monto_solicitado, balance.saldo_actual);
      setProcessingInfo(processing);
    } else {
      setProcessingInfo(null);
    }
  }, [withdrawalData.monto_solicitado, balance]);

  const loadUser = async () => {
    if (!supabase) return;
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
      await loadBalance(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async (userId: string) => {
    if (!supabase) return;
    try {
      setLoadingBalance(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const response = await fetch(`/api/model/savings/dashboard?modelId=${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      if (data.success && data.balance) {
        setBalance({
          saldo_actual: data.balance.saldo_actual
        });
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('es-CO').format(value);
  };

  const parseFormattedNumber = (value: string): number => {
    return parseFloat(value.replace(/[^\d]/g, '')) || 0;
  };

  const validateMonto = (monto: number): string => {
    const MIN_RETIRO = 100000;
    
    if (monto < MIN_RETIRO) {
      return `El monto mínimo de retiro es $${formatNumber(MIN_RETIRO)} COP`;
    }
    
    if (balance && monto > balance.saldo_actual) {
      return `El monto no puede superar tu saldo disponible: $${formatNumber(balance.saldo_actual)} COP`;
    }
    
    return '';
  };

  const handleMontoChange = (value: string) => {
    const numericValue = parseFormattedNumber(value);
    setWithdrawalData(prev => ({ ...prev, monto_solicitado: numericValue }));
    setMontoFormatted(value.replace(/[^0-9.,]/g, ''));
    const error = validateMonto(numericValue);
    setMontoError(error);
  };

  const handleMontoBlur = () => {
    const adjustedValue = Math.floor(withdrawalData.monto_solicitado / 10000) * 10000;
    setWithdrawalData(prev => ({ ...prev, monto_solicitado: adjustedValue }));
    setMontoFormatted(formatNumber(adjustedValue));
    setMontoError(validateMonto(adjustedValue));
  };

  const handleSaldoClick = () => {
    if (balance) {
      const roundedValue = Math.floor(balance.saldo_actual / 10000) * 10000;
      setWithdrawalData(prev => ({ ...prev, monto_solicitado: roundedValue }));
      setMontoFormatted(formatNumber(roundedValue));
      setMontoError(validateMonto(roundedValue));
    }
  };

  const validateTelefono = (telefono: string): string => {
    const cleanTelefono = telefono.replace(/\D/g, '');
    
    if (cleanTelefono.length === 0) {
      return '';
    }
    
    if (cleanTelefono.length !== 10) {
      return 'El número de teléfono debe tener exactamente 10 dígitos';
    }
    
    if (!cleanTelefono.startsWith('3')) {
      return 'El número debe empezar con 3 (celular colombiano)';
    }
    
    return '';
  };

  const handleTelefonoChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const limitedValue = numericValue.slice(0, 10);
    setWithdrawalData(prev => ({ ...prev, numero_telefono: limitedValue }));
    const error = validateTelefono(limitedValue);
    setTelefonoError(error);
  };

  const isFormValid = (): boolean => {
    const montoError = validateMonto(withdrawalData.monto_solicitado);
    if (montoError || withdrawalData.monto_solicitado <= 0) {
      return false;
    }

    if (withdrawalData.medio_pago === 'nequi' || withdrawalData.medio_pago === 'daviplata') {
      if (!withdrawalData.nombre_beneficiario?.trim() || !withdrawalData.numero_telefono?.trim()) {
        return false;
      }
      const telefonoError = validateTelefono(withdrawalData.numero_telefono);
      if (telefonoError) {
        return false;
      }
    }

    if (withdrawalData.medio_pago === 'cuenta_bancaria') {
      if (!withdrawalData.nombre_titular?.trim() || 
          !withdrawalData.banco?.trim() || 
          !withdrawalData.tipo_cuenta?.trim() || 
          !withdrawalData.numero_cuenta?.trim() || 
          !withdrawalData.documento_titular?.trim()) {
        return false;
      }
      if (withdrawalData.banco === 'Otros' && !withdrawalData.banco_otro?.trim()) {
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      setError('Sistema no inicializado. Por favor recarga la página.');
      return;
    }
    
    if (!user) return;
    
    const montoError = validateMonto(withdrawalData.monto_solicitado);
    if (montoError) {
      setError(montoError);
      return;
    }

    if (withdrawalData.medio_pago === 'nequi' || withdrawalData.medio_pago === 'daviplata') {
      if (!withdrawalData.nombre_beneficiario || !withdrawalData.numero_telefono) {
        setError('Nombre y número son requeridos para NEQUI/DAVIPLATA');
        return;
      }
      const telefonoError = validateTelefono(withdrawalData.numero_telefono);
      if (telefonoError) {
        setError(telefonoError);
        return;
      }
    }

    if (withdrawalData.medio_pago === 'cuenta_bancaria') {
      if (!withdrawalData.nombre_titular || !withdrawalData.banco || !withdrawalData.tipo_cuenta || !withdrawalData.numero_cuenta || !withdrawalData.documento_titular) {
        setError('Todos los campos bancarios son requeridos');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('No se pudo obtener el token de autorización');
        return;
      }

      const response = await fetch('/api/model/savings/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          monto_solicitado: withdrawalData.monto_solicitado,
          medio_pago: withdrawalData.medio_pago,
          nombre_beneficiario: withdrawalData.nombre_beneficiario,
          numero_telefono: withdrawalData.numero_telefono,
          nombre_titular: withdrawalData.nombre_titular,
          banco: withdrawalData.banco,
          banco_otro: withdrawalData.banco_otro,
          tipo_cuenta: withdrawalData.tipo_cuenta?.toLowerCase(),
          numero_cuenta: withdrawalData.numero_cuenta,
          documento_titular: withdrawalData.documento_titular
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/admin/model/finanzas/ahorro');
        }, 2000);
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingBalance) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="max-w-6xl mx-auto max-sm:px-0 sm:px-6 lg:px-8 pb-4 sm:pb-2 pt-6 sm:pt-2 relative z-10">
        {/* Header */}
        <PageHeader
          title="Solicitar Retiro"
          icon={
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />


        {error && (
          <div className="mb-6 relative overflow-hidden bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-xl border border-fuchsia-500/30 dark:border-fuchsia-400/30 rounded-xl p-4 shadow-lg shadow-fuchsia-500/10">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-fuchsia-500 to-cyan-500"></div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 bg-fuchsia-500/20">
                <svg className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{error}</p>
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
                Solicitud de retiro creada exitosamente. Redirigiendo...
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Formulario */}
          <div className="lg:col-span-2 relative z-[60]">
            <GlassCard padding="none" className="p-4 sm:p-6 !overflow-visible">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Saldo Disponible */}
                {balance && (
                  <div
                    onClick={handleSaldoClick}
                    className="cursor-pointer p-4 bg-purple-500/10 dark:bg-purple-500/15 rounded-xl border border-purple-500/20 dark:border-purple-500/30 hover:bg-purple-500/20 dark:hover:bg-purple-500/25 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saldo Disponible</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                          {formatNumber(balance.saldo_actual)} COP
                        </p>
                      </div>
                      <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Haz clic para usar todo el saldo disponible</p>
                  </div>
                )}

                {/* Monto a Retirar */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Monto a Retirar (COP) *
                  </label>
                  <input
                    type="text"
                    value={montoFormatted}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    onBlur={handleMontoBlur}
                    placeholder="Ej: 500000"
                    className={`w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)] ${
                      montoError ? 'border-red-500/50 dark:border-red-500/50' : 'border-black/10 dark:border-white/10'
                    }`}
                    required
                  />
                  {montoError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{montoError}</p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Mínimo: $100,000 COP | Máximo: Saldo disponible
                  </p>
                </div>

                {/* Información de procesamiento */}
                {processingInfo && withdrawalData.monto_solicitado > 0 && (
                  <div className="p-4 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 rounded-xl">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Tiempo de procesamiento: {processingInfo.tiempo}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Porcentaje del saldo: {processingInfo.porcentaje.toFixed(2)}%
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Fecha estimada: {processingInfo.fechaEstimada.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Medio de Pago */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                    Medio de Pago *
                  </label>
                  <AppleDropdown
                    variant="input"
                    options={[
                      { value: 'nequi', label: 'Nequi' },
                      { value: 'daviplata', label: 'DaviPlata' },
                      { value: 'cuenta_bancaria', label: 'Cuenta Bancaria' }
                    ]}
                    value={withdrawalData.medio_pago}
                    onChange={(value) => setWithdrawalData(prev => ({ ...prev, medio_pago: value as any }))}
                  />
                </div>

                {/* Campos según medio de pago */}
                {withdrawalData.medio_pago === 'nequi' || withdrawalData.medio_pago === 'daviplata' ? (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Nombre del Beneficiario *
                      </label>
                      <input
                        type="text"
                        value={withdrawalData.nombre_beneficiario || ''}
                        onChange={(e) => setWithdrawalData(prev => ({ ...prev, nombre_beneficiario: e.target.value }))}
                        className="w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Número de Teléfono *
                      </label>
                      <input
                        type="text"
                        value={withdrawalData.numero_telefono || ''}
                        onChange={(e) => handleTelefonoChange(e.target.value)}
                        placeholder="3001234567"
                        maxLength={10}
                        className={`w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)] ${
                          telefonoError ? 'border-red-500/50 dark:border-red-500/50' : 'border-black/10 dark:border-white/10'
                        }`}
                        required
                      />
                      {telefonoError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{telefonoError}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Nombre del Titular *
                      </label>
                      <input
                        type="text"
                        value={withdrawalData.nombre_titular || ''}
                        onChange={(e) => setWithdrawalData(prev => ({ ...prev, nombre_titular: e.target.value }))}
                        className="w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Banco *
                      </label>
                      <AppleDropdown
                        variant="input"
                        options={bancosColombia.map(b => ({ value: b, label: b }))}
                        value={withdrawalData.banco || ''}
                        onChange={(value) => setWithdrawalData(prev => ({ ...prev, banco: value }))}
                        placeholder="Selecciona un banco"
                      />
                    </div>
                    {withdrawalData.banco === 'Otros' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                          Nombre del Banco *
                        </label>
                        <input
                          type="text"
                          value={withdrawalData.banco_otro || ''}
                          onChange={(e) => setWithdrawalData(prev => ({ ...prev, banco_otro: e.target.value }))}
                          className="w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Tipo de Cuenta *
                      </label>
                      <AppleDropdown
                        variant="input"
                        options={tiposCuenta.map(t => ({ value: t.toLowerCase(), label: t }))}
                        value={withdrawalData.tipo_cuenta || ''}
                        onChange={(value) => setWithdrawalData(prev => ({ ...prev, tipo_cuenta: value as any }))}
                        placeholder="Selecciona tipo de cuenta"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Número de Cuenta *
                      </label>
                      <input
                        type="text"
                        value={withdrawalData.numero_cuenta || ''}
                        onChange={(e) => setWithdrawalData(prev => ({ ...prev, numero_cuenta: e.target.value }))}
                        className="w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Documento del Titular *
                      </label>
                      <input
                        type="text"
                        value={withdrawalData.documento_titular || ''}
                        onChange={(e) => setWithdrawalData(prev => ({ ...prev, documento_titular: e.target.value }))}
                        className="w-full bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-semibold rounded-xl hover:bg-black/[0.06] dark:hover:bg-white/[0.08] hover:border-black/10 dark:hover:border-white/[0.15] focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 block p-3 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Botón de envío */}
                <button
                  type="submit"
                  disabled={submitting || !isFormValid()}
                  className="w-full relative overflow-hidden min-h-[44px] sm:min-h-0 px-6 py-3 sm:py-3.5 text-[13px] sm:text-[14px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center group bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none backdrop-blur-md shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                    background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
                    backgroundSize: '200% 100%',
                    animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
                  }}></div>
                  <span className="relative z-10 flex items-center tracking-widest uppercase gap-2">
                    {submitting ? 'ENVIANDO...' : 'SOLICITAR RETIRO'}
                  </span>
                </button>
              </form>
            </GlassCard>
          </div>

          {/* Información lateral */}
          <div className="space-y-6">
            <GlassCard padding="lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Información Importante
              </h3>
              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    <strong>Límite:</strong> Mínimo $100,000 COP. Solo puedes realizar un retiro por período.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    <strong>Tiempo de procesamiento:</strong> Retiros menores al 50% del saldo: 48 horas. Retiros mayores al 50%: 3 días.
                  </p>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p>
                    <strong>Aprobación:</strong> Tu solicitud será revisada por un administrador antes de ser procesada.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
        <div className="mt-8 flex justify-center w-full relative z-20">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors duration-300 group"
          >
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform duration-300 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="relative">Volver a Ahorros
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-400 dark:bg-white transition-all duration-300 group-hover:w-full"></span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
