"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate } from '@/utils/calculator-dates';
import { canRequestAnticipo, AnticipoRestriction } from '@/utils/anticipo-restrictions';
import AppleDropdown from '@/components/ui/AppleDropdown';
import { InfoCardGrid } from '@/components/ui/InfoCard';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AnticipoData {
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

export default function SolicitarAnticipoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Datos del anticipo
  const [anticipoData, setAnticipoData] = useState<AnticipoData>({
    monto_solicitado: 0,
    medio_pago: 'nequi'
  });
  
  // AppleDropdown maneja automáticamente el estado de apertura
  
  // Datos de productividad
  const [productivityData, setProductivityData] = useState({
    copModelo: 0,
    anticipoDisponible: 0,
    anticiposPagados: 0
  });
  
  // Estados para validación y formato de monto
  const [montoError, setMontoError] = useState('');
  const [montoFormatted, setMontoFormatted] = useState('');
  const [telefonoError, setTelefonoError] = useState('');
  
  // Estado para restricciones temporales
  const [restrictionInfo, setRestrictionInfo] = useState<AnticipoRestriction | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  // Lista de bancos de Colombia (versión resumida)
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

  // Validar restricciones temporales
  useEffect(() => {
    const restriction = canRequestAnticipo();
    setRestrictionInfo(restriction);
    console.log('🔍 [SOLICITAR ANTICIPO] Restricción temporal:', restriction);
  }, []);

  // AppleDropdown maneja automáticamente el click-outside

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
      await loadProductivityData(userData.id);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadProductivityData = async (userId: string) => {
    try {
      console.log('🔍 [SOLICITAR ANTICIPO] Iniciando carga de datos de productividad para userId:', userId);
      
      // Obtener datos de productividad del período actual (Colombia)
      const periodDate = getColombiaDate();
      console.log('🔍 [SOLICITAR ANTICIPO] Periodo:', periodDate);
      
      // 🚀 SOLUCIÓN REAL: Usar la misma lógica de Mi Calculadora para obtener valores correctos
      console.log('🔍 [SOLICITAR ANTICIPO] Obteniendo valores reales de Mi Calculadora...');
      const miCalculadoraRealResponse = await fetch(`/api/calculator/mi-calculadora-real?modelId=${userId}&periodDate=${periodDate}&t=${Date.now()}`);
      const miCalculadoraRealData = await miCalculadoraRealResponse.json();
      console.log('🔍 [SOLICITAR ANTICIPO] Mi Calculadora real response:', miCalculadoraRealData);
      
      if (miCalculadoraRealData.success) {
        console.log('✅ [SOLICITAR ANTICIPO] Valores reales de Mi Calculadora obtenidos correctamente:', {
          copModelo: miCalculadoraRealData.data.copModelo,
          anticipoDisponible: miCalculadoraRealData.data.anticipoDisponible,
          anticiposPagados: miCalculadoraRealData.data.anticiposPagados
        });

        console.log('🔄 [SOLICITAR ANTICIPO] Estableciendo datos de productividad:', {
          copModelo: miCalculadoraRealData.data.copModelo,
          anticipoDisponible: miCalculadoraRealData.data.anticipoDisponible,
          anticiposPagados: miCalculadoraRealData.data.anticiposPagados
        });

        setProductivityData({
          copModelo: miCalculadoraRealData.data.copModelo,
          anticipoDisponible: miCalculadoraRealData.data.anticipoDisponible,
          anticiposPagados: miCalculadoraRealData.data.anticiposPagados
        });
      } else {
        console.error('❌ [SOLICITAR ANTICIPO] Error al obtener valores reales de Mi Calculadora:', miCalculadoraRealData.error);
        
        // Fallback: Establecer valores por defecto
        setProductivityData({
          copModelo: 0,
          anticipoDisponible: 0,
          anticiposPagados: 0
        });
      }
    } catch (error) {
      console.error('Error loading productivity data:', error);
      setError('Error al cargar datos de productividad');
    }
  };

  const handleInputChange = (field: keyof AnticipoData, value: any) => {
    setAnticipoData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculatePercentage = () => {
    if (productivityData.anticipoDisponible === 0) return 0;
    return (anticipoData.monto_solicitado / productivityData.anticipoDisponible) * 100;
  };

  // Función para formatear número con separadores de miles
  const formatNumber = (value: number): string => {
    return value.toLocaleString('es-CO');
  };

  // Función para parsear número desde string formateado
  const parseFormattedNumber = (value: string): number => {
    return parseFloat(value.replace(/\./g, '').replace(/,/g, '.')) || 0;
  };

  // Función para validar monto
  const validateMonto = (monto: number): string => {
    if (monto <= 0) {
      return 'El monto debe ser mayor a 0';
    }
    // Regla: el monto debe ser múltiplo de 10.000 COP
    if (monto % 10000 !== 0) {
      return 'El monto debe ser múltiplo de 10.000 COP';
    }
    if (monto > productivityData.anticipoDisponible) {
      return `El monto no puede superar $${formatNumber(productivityData.anticipoDisponible)} COP`;
    }
    return '';
  };


  // Manejar cambio en el input de monto (sin forzar aún el múltiplo)
  const handleMontoChange = (value: string) => {
    const numericValue = parseFormattedNumber(value);
    
    // Actualizar el valor numérico mientras escribe
    setAnticipoData(prev => ({ ...prev, monto_solicitado: numericValue }));
    
    // Formatear para mostrar lo que escribe
    setMontoFormatted(value.replace(/[^0-9.,]/g, ''));
    
    // Validar en vivo (puede mostrar error de múltiplo hasta que salga del campo)
    const error = validateMonto(numericValue);
    setMontoError(error);
  };

  // Al salir del campo, ajustar al múltiplo de 10.000 hacia abajo
  const handleMontoBlur = () => {
    const adjustedValue = roundDownToNearestTenThousand(anticipoData.monto_solicitado || 0);
    setAnticipoData(prev => ({ ...prev, monto_solicitado: adjustedValue }));
    setMontoFormatted(formatNumber(adjustedValue));
    setMontoError(validateMonto(adjustedValue));
  };

  // Función para redondear a la baja al múltiplo de 10.000 más cercano
  const roundDownToNearestTenThousand = (value: number): number => {
    return Math.floor(value / 10000) * 10000;
  };

  // Manejar clic en el cuadro "Anticipo Disponible"
  const handleAnticipoDisponibleClick = () => {
    const roundedValue = roundDownToNearestTenThousand(productivityData.anticipoDisponible);
    
    // Actualizar el valor numérico
    setAnticipoData(prev => ({ ...prev, monto_solicitado: roundedValue }));
    
    // Formatear para mostrar
    setMontoFormatted(formatNumber(roundedValue));
    
    // Limpiar errores si el valor es válido
    const error = validateMonto(roundedValue);
    setMontoError(error);
  };

  // Función para validar teléfono colombiano (10 dígitos)
  const validateTelefono = (telefono: string): string => {
    const cleanTelefono = telefono.replace(/\D/g, ''); // Solo números
    
    if (cleanTelefono.length === 0) {
      return '';
    }
    
    if (cleanTelefono.length !== 10) {
      return 'El número de teléfono debe tener exactamente 10 dígitos';
    }
    
    // Validar que empiece con 3 (celulares colombianos)
    if (!cleanTelefono.startsWith('3')) {
      return 'El número debe empezar con 3 (celular colombiano)';
    }
    
    return '';
  };

  // Manejar cambio en el campo de teléfono
  const handleTelefonoChange = (value: string) => {
    // Solo permitir números
    const numericValue = value.replace(/\D/g, '');
    
    // Limitar a 10 dígitos
    const limitedValue = numericValue.slice(0, 10);
    
    // Actualizar el estado
    setAnticipoData(prev => ({ ...prev, numero_telefono: limitedValue }));
    
    // Validar
    const error = validateTelefono(limitedValue);
    setTelefonoError(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Validaciones
    const montoError = validateMonto(anticipoData.monto_solicitado);
    if (montoError) {
      setError(montoError);
      return;
    }

    if (anticipoData.medio_pago === 'nequi' || anticipoData.medio_pago === 'daviplata') {
      if (!anticipoData.nombre_beneficiario || !anticipoData.numero_telefono) {
        setError('Nombre y número son requeridos para NEQUI/DAVIPLATA');
        return;
      }
      
      // Validar formato del teléfono
      const telefonoError = validateTelefono(anticipoData.numero_telefono);
      if (telefonoError) {
        setError(telefonoError);
        return;
      }
    }

    if (anticipoData.medio_pago === 'cuenta_bancaria') {
      if (!anticipoData.nombre_titular || !anticipoData.banco || !anticipoData.tipo_cuenta || !anticipoData.numero_cuenta || !anticipoData.documento_titular) {
        setError('Todos los campos bancarios son requeridos');
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);

      const periodDate = getColombiaDate();
      const porcentajeSolicitado = calculatePercentage();

      const response = await fetch('/api/anticipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: user.id,
          period_date: periodDate,
          monto_solicitado: anticipoData.monto_solicitado,
          porcentaje_solicitado: porcentajeSolicitado,
          monto_disponible: productivityData.anticipoDisponible,
          medio_pago: anticipoData.medio_pago,
          nombre_beneficiario: anticipoData.nombre_beneficiario,
          numero_telefono: anticipoData.numero_telefono,
          nombre_titular: anticipoData.nombre_titular,
          banco: anticipoData.banco,
          banco_otro: anticipoData.banco_otro,
          tipo_cuenta: anticipoData.tipo_cuenta,
          numero_cuenta: anticipoData.numero_cuenta,
          documento_titular: anticipoData.documento_titular
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/model/anticipos/solicitudes');
        }, 2000);
      } else {
        setError(data.error || 'Error al enviar solicitud');
      }
    } catch (error) {
      console.error('Error submitting anticipo:', error);
      setError('Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  // Mostrar pantalla de restricción si no está permitido solicitar anticipo
  if (restrictionInfo && !restrictionInfo.allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="mb-4">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Solicitud No Disponible
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {restrictionInfo.reason}
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Próxima fecha disponible:</strong><br />
                {restrictionInfo.nextAvailable?.toLocaleDateString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
          >
            Regresar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-300 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <style jsx>{`
        /* Dropdown compacto con scrollbar */
        .bank-select {
          max-height: 120px !important;
          overflow-y: auto !important;
        }
        .bank-select::-webkit-scrollbar {
          width: 6px;
        }
        .bank-select::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .bank-select::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .bank-select::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                      Solicitar Anticipo
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Solicita un anticipo de hasta el 90% de tu productividad
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Acceso: <span className="font-medium text-blue-600 dark:text-blue-400">Modelo</span>
                </div>
              </div>

              {/* Indicador de política activa integrado */}
              <div className="mt-4 p-3 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Política de fechas activa</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400">No disponible del fin de mes al 5 y del 15 al 20</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de Productividad - ESTILO APPLE REFINADO */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 mb-6 hover:shadow-md transition-all duration-300 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
            Resumen de Productividad
          </h2>
          <InfoCardGrid
            cards={[
              {
                value: `$${productivityData.copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                label: 'COP Modelo',
                color: 'blue'
              },
              {
                value: `$${productivityData.anticipoDisponible.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                label: 'Anticipo Disponible',
                color: 'green',
                onClick: handleAnticipoDisponibleClick,
                clickable: true
              },
              {
                value: `$${productivityData.anticiposPagados.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                label: 'Ya Pagados',
                color: 'orange'
              }
            ]}
            columns={3}
          />
        </div>

        {/* Formulario */}
        <div className="bg-white dark:bg-gray-700/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-600/20 p-6 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Datos del Anticipo</h2>
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-800 dark:text-green-300 font-medium">¡Solicitud enviada correctamente!</span>
              </div>
              <p className="text-green-700 dark:text-green-400 text-sm mt-1">Serás redirigido a "Mis Solicitudes" en unos segundos...</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 dark:text-red-300 font-medium">Error</span>
              </div>
              <p className="text-red-700 dark:text-red-400 text-sm mt-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Monto Solicitado y Medio de Pago - Layout Horizontal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monto Solicitado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  Monto Solicitado (COP)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={montoFormatted}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    onBlur={handleMontoBlur}
                    placeholder=""
                    className={`apple-input w-full pr-20 ${montoError && anticipoData.monto_solicitado > 0 ? 'border-red-500 focus:ring-red-500' : ''}`}
                    style={{ paddingLeft: '2rem' }}
                  />
                  <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium select-none pointer-events-none">
                    $
                  </div>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-blue-600">
                    {calculatePercentage().toFixed(1)}%
                  </div>
                </div>
                {montoError && anticipoData.monto_solicitado > 0 && (
                  <p className="text-red-500 text-xs mt-1">{montoError}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Máximo disponible: ${roundDownToNearestTenThousand(productivityData.anticipoDisponible).toLocaleString('es-CO')} COP (múltiplos de 10.000)
                </p>
              </div>

              {/* Medio de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                  Medio de Pago
                </label>
                <div className="space-y-3">
                  {['nequi', 'daviplata', 'cuenta_bancaria'].map((medio) => (
                    <label key={medio} className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="medio_pago"
                        value={medio}
                        checked={anticipoData.medio_pago === medio}
                        onChange={(e) => handleInputChange('medio_pago', e.target.value)}
                        className="mr-3 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {medio === 'cuenta_bancaria' ? 'CUENTA BANCARIA' : medio.toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Datos NEQUI/DAVIPLATA */}
            {(anticipoData.medio_pago === 'nequi' || anticipoData.medio_pago === 'daviplata') && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700/50">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-4">Datos de {anticipoData.medio_pago.toUpperCase()}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Nombre del Beneficiario
                    </label>
                    <input
                      type="text"
                      value={anticipoData.nombre_beneficiario || ''}
                      onChange={(e) => handleInputChange('nombre_beneficiario', e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Número de {anticipoData.medio_pago.toUpperCase()}
                    </label>
                    <input
                      type="tel"
                      value={anticipoData.numero_telefono || ''}
                      onChange={(e) => handleTelefonoChange(e.target.value)}
                      placeholder="Número de teléfono (10 dígitos)"
                      className={`w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 ${telefonoError ? 'border-red-500 focus:ring-red-500' : ''}`}
                      maxLength={10}
                      required
                    />
                    {telefonoError && (
                      <p className="text-red-500 text-xs mt-1">{telefonoError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Datos Cuenta Bancaria */}
            {anticipoData.medio_pago === 'cuenta_bancaria' && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700/50">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-6">Datos de CUENTA BANCARIA</h3>
                
                {/* Primera fila: Nombre del Titular y Banco */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Nombre del Titular
                    </label>
                    <input
                      type="text"
                      value={anticipoData.nombre_titular || ''}
                      onChange={(e) => handleInputChange('nombre_titular', e.target.value)}
                      placeholder="Nombre completo del titular"
                      className="w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Banco
                    </label>
                    <AppleDropdown
                      options={[
                        { value: '', label: 'Selecciona un banco' },
                        ...bancosColombia.map(banco => ({
                          value: banco,
                          label: banco
                        }))
                      ]}
                      value={anticipoData.banco || ''}
                      onChange={(value) => handleInputChange('banco', value)}
                      placeholder="Selecciona un banco"
                      maxHeight="max-h-32"
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Banco Otros */}
                {anticipoData.banco === 'Otros' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Nombre del Banco
                    </label>
                    <input
                      type="text"
                      value={anticipoData.banco_otro || ''}
                      onChange={(e) => handleInputChange('banco_otro', e.target.value)}
                      placeholder="Escribe el nombre del banco"
                      className="w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                      required
                    />
                  </div>
                )}

                {/* Segunda fila: Tipo de Cuenta y Número de Cuenta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Tipo de Cuenta
                    </label>
                    <AppleDropdown
                      options={[
                        { value: '', label: 'Selecciona tipo de cuenta' },
                        ...tiposCuenta.map(tipo => ({
                          value: tipo.toLowerCase(),
                          label: tipo
                        }))
                      ]}
                      value={anticipoData.tipo_cuenta || ''}
                      onChange={(value) => handleInputChange('tipo_cuenta', value)}
                      placeholder="Selecciona tipo de cuenta"
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                      Número de Cuenta
                    </label>
                    <input
                      type="text"
                      value={anticipoData.numero_cuenta || ''}
                      onChange={(e) => handleInputChange('numero_cuenta', e.target.value)}
                      placeholder="Número de cuenta"
                      className="w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                      required
                    />
                  </div>
                </div>

                {/* Tercera fila: Documento del Titular */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                    Documento del Titular
                  </label>
                  <input
                    type="text"
                    value={anticipoData.documento_titular || ''}
                    onChange={(e) => handleInputChange('documento_titular', e.target.value)}
                    placeholder="Cédula o documento de identidad"
                    className="w-full px-3 py-2 text-sm text-left border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                    required
                  />
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-center pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || productivityData.anticipoDisponible <= 0 || !!montoError || anticipoData.monto_solicitado <= 0 || !!telefonoError}
                  className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
                >
                  {submitting ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}