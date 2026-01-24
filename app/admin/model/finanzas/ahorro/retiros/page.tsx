"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { calculateProcessingTime } from '@/lib/savings/savings-utils';
import AppleDropdown from '@/components/ui/AppleDropdown';
import InfoCard from '@/components/ui/InfoCard';

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
  const supabase = require('@/lib/supabase').supabase;

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
    loadUser();
  }, []);

  useEffect(() => {
    if (withdrawalData.monto_solicitado > 0 && balance) {
      const processing = calculateProcessingTime(withdrawalData.monto_solicitado, balance.saldo_actual);
      setProcessingInfo(processing);
    } else {
      setProcessingInfo(null);
    }
  }, [withdrawalData.monto_solicitado, balance]);

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
      await loadBalance(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async (userId: string) => {
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
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-red-500/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-purple-900/15 dark:ring-0.5 dark:ring-purple-400/20">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Solicitar Retiro
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Retira parte de tus ahorros acumulados
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
                Solicitud de retiro creada exitosamente. Redirigiendo...
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-2">
            <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-purple-900/10 dark:ring-0.5 dark:ring-purple-500/15">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Saldo Disponible */}
                {balance && (
                  <div
                    onClick={handleSaldoClick}
                    className="cursor-pointer p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all"
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
                    className={`w-full border rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200 ${
                      montoError ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-600'
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
                  <div className="p-4 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg">
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
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
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
                        className={`w-full border rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200 ${
                          telefonoError ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-600'
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
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Banco *
                      </label>
                      <AppleDropdown
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
                          className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                        Tipo de Cuenta *
                      </label>
                      <AppleDropdown
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
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
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
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Botón de envío */}
                <button
                  type="submit"
                  disabled={submitting || !isFormValid()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Enviando...' : 'Solicitar Retiro'}
                </button>
              </form>
            </div>
          </div>

          {/* Información lateral */}
          <div className="space-y-6">
            <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-md dark:shadow-lg dark:shadow-purple-900/10 dark:ring-0.5 dark:ring-purple-500/15">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
