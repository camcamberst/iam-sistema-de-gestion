"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getColombiaDate, getColombiaPeriodStartDate } from '@/utils/calculator-dates';
import { canRequestAnticipo, AnticipoRestriction } from '@/utils/anticipo-restrictions';
import AppleDropdown from '@/components/ui/AppleDropdown';
import InfoCard, { InfoCardGrid } from '@/components/ui/InfoCard';
import GlassCard from '@/components/ui/GlassCard';
import PageHeader from '@/components/ui/PageHeader';
import PillTabs from '@/components/ui/PillTabs';
import ModelAuroraBackground from '@/components/ui/ModelAuroraBackground';

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
  const [loadingProductivity, setLoadingProductivity] = useState(true); // Nuevo estado
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // States para Navegación de Tabs
  const [activeTab, setActiveTab] = useState<'nueva' | 'historial'>('nueva');
  
  // States para el Historial
  const [historialAnticipos, setHistorialAnticipos] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  // Datos del anticipo
  const [anticipoData, setAnticipoData] = useState<AnticipoData>({
    monto_solicitado: 0,
    medio_pago: 'nequi'
  });
  
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

  // Cargar historial si la tab está activa
  useEffect(() => {
    if (activeTab === 'historial' && user?.id) {
      loadHistorial(user.id);
    }
  }, [activeTab, user?.id]);

  const loadHistorial = async (userId: string) => {
    try {
      setLoadingHistorial(true);
      const response = await fetch(`/api/anticipos?modelId=${userId}`);
      const data = await response.json();
      if (data.success) {
        setHistorialAnticipos(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching historial:', e);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const cancelAnticipo = async (id: string) => {
    if (!window.confirm('¿Estás seguro de cancelar tu solicitud de anticipo?')) return;
    try {
      setCancellingId(id);
      const { error } = await supabase
        .from('anticipos')
        .update({ estado: 'declinado', comentarios_admin: 'Cancelado por el modelo' })
        .eq('id', id)
        .eq('estado', 'pendiente');
      
      if (!error && user?.id) {
        loadHistorial(user.id);
        loadProductivityData(user.id); // Reload amounts
      } else {
        alert('Hubo un error al cancelar al anticipo. Verifica que aún esté en estado pendiente.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCancellingId(null);
    }
  };

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
      setLoadingProductivity(true);
      console.log('🔍 [SOLICITAR ANTICIPO] Iniciando carga de datos de productividad para userId:', userId);
      
      // Obtener datos de productividad del período actual (Colombia)
      const periodDate = getColombiaPeriodStartDate();
      console.log('🔍 [SOLICITAR ANTICIPO] Periodo normalizado:', periodDate);
      
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
      // No bloquear la UI, pero mostrar error
    } finally {
      setLoadingProductivity(false);
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

  // Función para validar si el formulario está completo
  const isFormValid = (): boolean => {
    // Validar monto
    const montoError = validateMonto(anticipoData.monto_solicitado);
    if (montoError || anticipoData.monto_solicitado <= 0) {
      return false;
    }

    // Validar según el medio de pago seleccionado
    if (anticipoData.medio_pago === 'nequi' || anticipoData.medio_pago === 'daviplata') {
      // Para NEQUI/DAVIPLATA: nombre y teléfono son requeridos
      if (!anticipoData.nombre_beneficiario?.trim() || !anticipoData.numero_telefono?.trim()) {
        return false;
      }
      
      // Validar formato del teléfono
      const telefonoError = validateTelefono(anticipoData.numero_telefono);
      if (telefonoError) {
        return false;
      }
    }

    if (anticipoData.medio_pago === 'cuenta_bancaria') {
      // Para cuenta bancaria: todos los campos son requeridos
      if (!anticipoData.nombre_titular?.trim() || 
          !anticipoData.banco?.trim() || 
          !anticipoData.tipo_cuenta?.trim() || 
          !anticipoData.numero_cuenta?.trim() || 
          !anticipoData.documento_titular?.trim()) {
        return false;
      }
      
      // Si seleccionó "Otros" como banco, validar que haya escrito el nombre
      if (anticipoData.banco === 'Otros' && !anticipoData.banco_otro?.trim()) {
        return false;
      }
    }

    return true;
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

      // 🔧 FIX: Usar fecha normalizada al inicio del período
      const periodDate = getColombiaPeriodStartDate();
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
      <div className="min-h-[100dvh] relative w-full overflow-hidden flex flex-col items-center justify-start pt-[20vh] sm:pt-[25vh]">
        <ModelAuroraBackground />
        <div className="relative z-10 w-[calc(100%-2.5rem)] max-w-[320px] sm:max-w-md mx-auto text-center p-5 sm:p-7 bg-white/10 dark:bg-gray-900/40 backdrop-blur-md rounded-[1.5rem] sm:rounded-2xl border border-white/20 shadow-xl">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4 tracking-tight drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] flex items-center justify-center">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-500 dark:bg-amber-400 rounded-full mr-2 sm:mr-2.5 shadow-[0_0_5px_rgba(245,158,11,0.6)]"></span>
              Solicitud No Disponible
            </h2>
            <p className="text-[13.5px] sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-5 leading-snug">
              {restrictionInfo.reason}
            </p>
            <div className="bg-blue-50/80 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/50 rounded-[12px] p-3 sm:p-4">
              <p className="text-[12.5px] sm:text-sm text-blue-800 dark:text-blue-300">
                <strong className="block mb-0.5">Próxima fecha disponible:</strong>
                <span className="capitalize">
                  {restrictionInfo.nextAvailable?.toLocaleDateString('es-CO', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/model/dashboard')}
            className="w-full sm:w-auto mx-auto relative overflow-hidden min-h-[44px] sm:min-h-0 px-8 py-2.5 sm:px-8 sm:py-2.5 text-[13px] sm:text-[14px] font-extrabold rounded-full transition-all duration-300 transform active:scale-95 whitespace-nowrap touch-manipulation flex items-center justify-center group bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-white border-none backdrop-blur-md shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] hover:shadow-lg hover:shadow-fuchsia-500/40 dark:hover:shadow-[0_0_20px_rgba(232,121,249,0.7)]"
          >
            <div className="absolute inset-0 z-0 mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
              background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(232,121,249,0.5), transparent)',
              backgroundSize: '200% 100%',
              animation: 'aurora-flow 1.5s ease-in-out infinite alternate'
            }}></div>
            <span className="relative z-10 flex items-center tracking-widest uppercase">
              REGRESAR
            </span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center bg-white/20 dark:bg-gray-900/40 p-6 rounded-2xl backdrop-blur-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-800 dark:text-gray-200 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen relative w-full overflow-hidden flex items-center justify-center">
        <ModelAuroraBackground />
        <div className="relative z-10 text-center bg-white/20 dark:bg-gray-900/40 p-8 rounded-2xl backdrop-blur-md border border-white/20">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acceso Denegado</h1>
          <p className="text-gray-700 dark:text-gray-300">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative w-full overflow-hidden">
      <ModelAuroraBackground />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-20 xl:px-32 py-8 pt-6 sm:pt-8">
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
        <PageHeader
          title="Mis Anticipos"
          subtitle="Servicio no disponible en cierres de periodos y hasta después de días de pago"
          glow="model"
          icon={<span className="font-bold text-white text-xl sm:text-2xl pt-1">$</span>}
          actionClassName="max-sm:hidden"
          actions={
            <PillTabs
              variant="guardar"
              tabs={[
                { id: 'nueva', label: 'Nueva Solicitud' },
                { id: 'historial', label: 'Mi Historial' }
              ]}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
            />
          }
        />

        {/* Controles de Pestañas (Exclusivo en MÓVIL, centrado y debajo del header) */}
        <div className="w-full sm:hidden flex justify-center px-0 mb-6">
          <PillTabs
            variant="guardar"
            tabs={[
              { id: 'nueva', label: 'Nueva Solicitud' },
              { id: 'historial', label: 'Mi Historial' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
          />
        </div>

        {activeTab === 'nueva' && (
          <div className="animate-fade-in-up">
        {/* Resumen de Productividad - ESTILO APPLE REFINADO */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 px-1 mb-2 mt-2">
          <div className="flex items-center justify-center text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            <span className="hidden sm:inline">Resumen de&nbsp;</span>Productividad
          </h2>
        </div>
        <div className="flex-1 relative glass-card bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] max-sm:p-1.5 sm:p-2.5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden mb-4 sm:mb-6 hover:shadow-md transition-all duration-300">
          <div className="relative z-10 flex flex-col flex-1">
            <InfoCardGrid
              columns={3}
              cards={[
                {
                  value: loadingProductivity ? '...' : `$${productivityData.copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                  label: "COP Modelo",
                  color: "blue",
                  size: "sm"
                },
                {
                  value: loadingProductivity ? '...' : `$${productivityData.anticipoDisponible.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                  label: "Disponible",
                  color: "green",
                  onClick: !loadingProductivity ? handleAnticipoDisponibleClick : undefined,
                  clickable: !loadingProductivity,
                  size: "sm"
                },
                {
                  value: loadingProductivity ? '...' : `$${productivityData.anticiposPagados.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                  label: "Realizados",
                  color: "purple",
                  size: "sm"
                }
              ]}
            />
          </div>
        </div>
          
        {productivityData.copModelo === 0 && !loadingProductivity && (
          <div className="mb-4 sm:mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-[1.25rem] sm:rounded-2xl">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-300">
                  No se encontraron valores registrados
                </p>
                <p className="text-yellow-700 dark:text-yellow-400 mt-1">
                  Asegúrate de haber ingresado y <strong>guardado</strong> tus ganancias en <button onClick={() => router.push('/admin/model/calculator')} className="underline hover:text-yellow-900 dark:hover:text-yellow-200">Mi Calculadora</button> para este periodo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Formulario */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 px-1 mb-2 mt-6 sm:mt-8">
          <div className="flex items-center justify-center text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
            <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            Datos del Anticipo
          </h2>
        </div>
        <div className="flex-1 relative glass-card bg-black/[0.08] dark:bg-white/[0.06] backdrop-blur-3xl border border-white/40 dark:border-white/[0.08] p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl shadow-sm shadow-black/5 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_4px_20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden mb-4 sm:mb-6 hover:shadow-md transition-all duration-300">
          
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

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-7">
            {/* Monto Solicitado y Medio de Pago - Layout Horizontal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              {/* Monto Solicitado */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-2 tracking-wide uppercase">
                  Monto Solicitado (COP)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={montoFormatted}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    onBlur={handleMontoBlur}
                    placeholder=""
                    className={`w-full pr-16 h-10 text-[14px] font-medium bg-white/60 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${montoError && anticipoData.monto_solicitado > 0 ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
                    style={{ paddingLeft: '1.75rem' }}
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium text-[14px] select-none pointer-events-none">
                    $
                  </div>
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/60 dark:bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-200/50 dark:border-blue-700/50">
                    {calculatePercentage().toFixed(1)}%
                  </div>
                </div>
                {montoError && anticipoData.monto_solicitado > 0 && (
                  <p className="text-red-500 text-[11px] mt-1.5">{montoError}</p>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  Máximo: ${roundDownToNearestTenThousand(productivityData.anticipoDisponible).toLocaleString('es-CO')} COP (múltiplos de 10.000)
                </p>
              </div>

              {/* Medio de Pago */}
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-2 tracking-wide uppercase">
                  Medio de Pago
                </label>
                <div className="space-y-2">
                  {['nequi', 'daviplata', 'cuenta_bancaria'].map((medio) => (
                    <label key={medio} className="flex items-center px-3 py-2.5 rounded-xl border border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/30 active:scale-[0.99] cursor-pointer transition-all touch-manipulation min-h-[40px]">
                      <input
                        type="radio"
                        name="medio_pago"
                        value={medio}
                        checked={anticipoData.medio_pago === medio}
                        onChange={(e) => handleInputChange('medio_pago', e.target.value)}
                        className="mr-3 w-4 h-4 text-blue-500 border-gray-300 dark:border-gray-600 focus:ring-blue-500/50 bg-white dark:bg-gray-800"
                      />
                      <span className="text-[13px] font-medium text-gray-800 dark:text-gray-200">
                        {medio === 'cuenta_bancaria' ? 'Cuenta Bancaria' : medio.toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Datos NEQUI/DAVIPLATA */}
            {(anticipoData.medio_pago === 'nequi' || anticipoData.medio_pago === 'daviplata') && (
              <div className="bg-blue-50/50 dark:bg-[#1E293B]/60 rounded-xl p-4 sm:p-5 border border-blue-200/60 dark:border-blue-500/20 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/70 dark:bg-blue-400/50 rounded-l-xl"></div>
                <h3 className="text-[14px] font-semibold text-blue-800 dark:text-blue-300 mb-3">Datos de {anticipoData.medio_pago.toUpperCase()}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Nombre del Beneficiario
                    </label>
                    <input
                      type="text"
                      value={anticipoData.nombre_beneficiario || ''}
                      onChange={(e) => handleInputChange('nombre_beneficiario', e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full px-3 py-2 h-10 text-[13px] text-left border border-black/10 dark:border-white/10 rounded-lg bg-white/70 dark:bg-black/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Número de {anticipoData.medio_pago.toUpperCase()}
                    </label>
                    <input
                      type="tel"
                      value={anticipoData.numero_telefono || ''}
                      onChange={(e) => handleTelefonoChange(e.target.value)}
                      placeholder="Teléfono (10 dígitos)"
                      className={`w-full px-3 py-2 h-10 text-[13px] text-left border border-black/10 dark:border-white/10 rounded-lg bg-white/70 dark:bg-black/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all ${telefonoError ? 'border-red-500/50 focus:ring-red-500/50' : ''}`}
                      maxLength={10}
                      required
                    />
                    {telefonoError && (
                      <p className="text-red-500 text-[11px] mt-1">{telefonoError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Datos Cuenta Bancaria */}
            {anticipoData.medio_pago === 'cuenta_bancaria' && (
              <div className="bg-emerald-50/50 dark:bg-[#064E3B]/30 rounded-xl p-4 sm:p-5 border border-emerald-200/60 dark:border-emerald-500/20 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/70 dark:bg-emerald-400/50 rounded-l-xl"></div>
                <h3 className="text-[14px] font-semibold text-emerald-800 dark:text-emerald-400 mb-3">Datos de Cuenta Bancaria</h3>
                
                {/* Primera fila: Nombre del Titular y Banco */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-4 sm:mb-5">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Nombre del Titular
                    </label>
                    <input
                      type="text"
                      value={anticipoData.nombre_titular || ''}
                      onChange={(e) => handleInputChange('nombre_titular', e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full px-3 py-2 h-10 text-[13px] text-left border border-black/10 dark:border-white/10 rounded-lg bg-white/70 dark:bg-black/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Banco
                    </label>
                    <AppleDropdown
                      options={bancosColombia.map(banco => ({
                        value: banco,
                        label: banco
                      }))}
                      value={anticipoData.banco || ''}
                      onChange={(value) => handleInputChange('banco', value)}
                      placeholder="Selecciona banco"
                      maxHeight="max-h-40"
                      className="text-[13px] !h-10 border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30"
                      variant="input"
                    />
                  </div>
                </div>

                {/* Banco Otros */}
                {anticipoData.banco === 'Otros' && (
                  <div className="mb-4 sm:mb-5">
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Nombre del Banco
                    </label>
                    <input
                      type="text"
                      value={anticipoData.banco_otro || ''}
                      onChange={(e) => handleInputChange('banco_otro', e.target.value)}
                      placeholder="Especifica el banco"
                      className="w-full px-3 py-2 h-10 text-[13px] text-left border border-black/10 dark:border-white/10 rounded-lg bg-white/70 dark:bg-black/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      required
                    />
                  </div>
                )}

                {/* Segunda fila: Tipo de Cuenta y Número de Cuenta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-2">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Tipo de Cuenta
                    </label>
                    <AppleDropdown
                      options={tiposCuenta.map(tipo => ({
                        value: tipo.toLowerCase(),
                        label: tipo
                      }))}
                      value={anticipoData.tipo_cuenta || ''}
                      onChange={(value) => handleInputChange('tipo_cuenta', value)}
                      placeholder="Ahorros o Corriente"
                      className="text-[13px] !h-10 border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30"
                      variant="input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                      Número de Cuenta
                    </label>
                    <input
                      type="text"
                      value={anticipoData.numero_cuenta || ''}
                      onChange={(e) => handleInputChange('numero_cuenta', e.target.value.replace(/\\D/g, ''))}
                      placeholder="Sólo números"
                      className="w-full px-3 py-2 h-10 text-[13px] text-left border border-black/10 dark:border-white/10 rounded-lg bg-white/70 dark:bg-black/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Tercera fila: Documento del Titular */}
                <div>
                  <label className="block text-[12px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    Documento del Titular
                  </label>
                  <input
                    type="text"
                    value={anticipoData.documento_titular || ''}
                    onChange={(e) => handleInputChange('documento_titular', e.target.value)}
                    placeholder="Cédula o documento de identidad"
                    className="w-full px-3 py-2 h-10 text-[13px] text-left border border-black/10 dark:border-white/10 rounded-lg bg-white/70 dark:bg-black/30 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    required
                  />
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-center pt-6 sm:pt-8 mt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="max-sm:w-full max-sm:flex sm:w-fit sm:inline-flex flex-row items-center justify-center p-1 bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-xl rounded-full border border-black/[0.05] dark:border-white/[0.05]">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="relative max-sm:flex-1 max-sm:px-4 max-sm:py-1.5 sm:px-6 sm:py-1.5 text-xs sm:text-[13px] font-medium rounded-full transition-all duration-300 ease-out active:scale-[0.97] touch-manipulation whitespace-nowrap flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-white hover:font-bold hover:bg-gradient-to-r hover:from-cyan-600 hover:to-fuchsia-600 hover:shadow-md hover:shadow-cyan-500/30 dark:hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] border border-transparent"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || productivityData.anticipoDisponible <= 0 || !isFormValid()}
                  className="relative max-sm:flex-1 max-sm:px-4 max-sm:py-1.5 sm:px-6 sm:py-1.5 text-xs sm:text-[13px] font-medium rounded-full transition-all duration-300 ease-out active:scale-[0.97] touch-manipulation whitespace-nowrap flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-white hover:font-bold hover:bg-gradient-to-r hover:from-cyan-600 hover:to-fuchsia-600 hover:shadow-md hover:shadow-cyan-500/30 dark:hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] border border-transparent disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? 'Enviando...' : <><span className="hidden sm:inline">Enviar Solicitud</span><span className="sm:hidden">Enviar</span></>}
                </button>
              </div>
            </div>
          </form>
        </div>
        </div>
        )}

        {/* TAB HISTORIAL */}
        {activeTab === 'historial' && (
          <div className="animate-fade-in-up mt-4">
            <div className="flex items-center space-x-1 sm:space-x-1.5 px-1 mb-2">
              <div className="flex items-center justify-center text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                <svg className="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-[14px] sm:text-[15px] font-bold text-gray-900 dark:text-white tracking-tight drop-shadow-[0_0_8px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                Historial de Anticipos
              </h2>
            </div>
            <GlassCard glow="model" padding="none" className="rounded-2xl p-4 sm:p-6 min-h-[400px]">
              
              {loadingHistorial ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : historialAnticipos.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <p>No tienes solicitudes de anticipos registradas.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historialAnticipos.map((anticipo) => (
                    <div key={anticipo.id} className="bg-white dark:bg-gray-800/80 rounded-xl p-4 sm:p-5 border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              ${anticipo.monto_solicitado.toLocaleString('es-CO')}
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              anticipo.estado === 'pendiente' ? 'bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              anticipo.estado === 'aprobado' ? 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              anticipo.estado === 'confirmado' || anticipo.estado === 'realizado' ? 'bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              'bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {anticipo.estado.charAt(0).toUpperCase() + anticipo.estado.slice(1)}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Medio:</span> {anticipo.medio_pago.toUpperCase()}</p>
                            <p><span className="font-semibold text-gray-700 dark:text-gray-300">Fecha:</span> {new Date(anticipo.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            {anticipo.comentarios_admin && (
                              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-2 rounded">
                                Nota Admin: "{anticipo.comentarios_admin}"
                              </p>
                            )}
                          </div>
                        </div>

                        {anticipo.estado === 'pendiente' && (
                          <div className="flex-shrink-0">
                            <button
                              onClick={() => cancelAnticipo(anticipo.id)}
                              disabled={cancellingId === anticipo.id}
                              className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50/50 border border-red-200/50 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg transition-colors focus:outline-none w-full sm:w-auto"
                            >
                              {cancellingId === anticipo.id ? 'Cancelando...' : 'Cancelar Solicitud'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
