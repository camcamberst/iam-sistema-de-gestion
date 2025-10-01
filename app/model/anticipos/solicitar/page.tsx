"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
  
  // Estado para dropdowns personalizados
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [isAccountTypeDropdownOpen, setIsAccountTypeDropdownOpen] = useState(false);
  
  // Datos de productividad
  const [productivityData, setProductivityData] = useState({
    copModelo: 0,
    anticipoDisponible: 0,
    anticiposPagados: 0
  });

  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

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

  // Cerrar dropdowns cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (isBankDropdownOpen && !target.closest('.bank-dropdown')) {
        setIsBankDropdownOpen(false);
      }
      
      if (isAccountTypeDropdownOpen && !target.closest('.account-type-dropdown')) {
        setIsAccountTypeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isBankDropdownOpen, isAccountTypeDropdownOpen]);

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
      // Obtener datos de productividad del período actual
      const periodDate = new Date().toISOString().split('T')[0];
      
      // Cargar configuración de calculadora
      const configResponse = await fetch(`/api/calculator/config-v2?userId=${userId}`);
      const configData = await configResponse.json();
      
      if (!configData.success) {
        throw new Error('Error al cargar configuración');
      }

      // Cargar valores del modelo
      const valuesResponse = await fetch(`/api/calculator/model-values-v2?userId=${userId}&periodDate=${periodDate}`);
      const valuesData = await valuesResponse.json();
      
      // Cargar tasas
      const ratesResponse = await fetch('/api/rates-v2?activeOnly=true');
      const ratesData = await ratesResponse.json();
      
      if (ratesData.success && configData.config && valuesData.success) {
        const rates = {
          usd_cop: ratesData.data.find((r: any) => r.kind === 'USD→COP')?.value || 3900,
          eur_usd: ratesData.data.find((r: any) => r.kind === 'EUR→USD')?.value || 1.01,
          gbp_usd: ratesData.data.find((r: any) => r.kind === 'GBP→USD')?.value || 1.20
        };

        // Calcular COP Modelo (misma lógica que en la calculadora)
        let copModelo = 0;
        const enabledPlatforms = configData.config.platforms
          .filter((p: any) => p.enabled)
          .map((platform: any) => ({
            id: platform.id,
            name: platform.name,
            enabled: true,
            value: 0,
            percentage: platform.percentage_override || platform.group_percentage || 80,
            currency: platform.currency || 'USD'
          }));

        const platformValuesMap = new Map(valuesData.values.map((mv: any) => [mv.platform_id, mv.value]));

        enabledPlatforms.forEach((p: any) => {
          const value = Number(platformValuesMap.get(p.id) || 0);
          let usdBrutoPlatform = 0;
          let usdModeloPlatform = 0;

          // Aplicar fórmulas específicas por plataforma
          if (p.currency === 'EUR') {
            if (p.id === 'big7') {
              usdBrutoPlatform = value * (rates.eur_usd || 1.01);
              usdModeloPlatform = usdBrutoPlatform * 0.84;
            } else if (p.id === 'mondo') {
              usdBrutoPlatform = value * (rates.eur_usd || 1.01);
              usdModeloPlatform = usdBrutoPlatform * 0.78;
            } else {
              usdBrutoPlatform = value * (rates.eur_usd || 1.01);
              usdModeloPlatform = usdBrutoPlatform;
            }
          } else if (p.currency === 'GBP') {
            if (p.id === 'aw') {
              usdBrutoPlatform = value * (rates.gbp_usd || 1.20);
              usdModeloPlatform = usdBrutoPlatform * 0.677;
            } else {
              usdBrutoPlatform = value * (rates.gbp_usd || 1.20);
              usdModeloPlatform = usdBrutoPlatform;
            }
          } else if (p.currency === 'USD') {
            if (p.id === 'cmd' || p.id === 'camlust' || p.id === 'skypvt') {
              usdBrutoPlatform = value;
              usdModeloPlatform = value * 0.75;
            } else if (p.id === 'chaturbate' || p.id === 'myfreecams' || p.id === 'stripchat') {
              usdBrutoPlatform = value;
              usdModeloPlatform = value * 0.05;
            } else if (p.id === 'dxlive') {
              usdBrutoPlatform = value;
              usdModeloPlatform = value * 0.60;
            } else if (p.id === 'secretfriends') {
              usdBrutoPlatform = value;
              usdModeloPlatform = value * 0.5;
            } else if (p.id === 'superfoon') {
              usdBrutoPlatform = value;
              usdModeloPlatform = value;
            } else {
              usdBrutoPlatform = value;
              usdModeloPlatform = value;
            }
          }

          usdModeloPlatform = usdModeloPlatform * (p.percentage / 100);
          copModelo += usdModeloPlatform * (rates.usd_cop || 3900);
        });

        // Obtener anticipos ya pagados en el período actual
        const anticiposResponse = await fetch(`/api/anticipos/paid?modelId=${userId}&periodDate=${periodDate}`);
        const anticiposData = await anticiposResponse.json();
        const anticiposPagados = anticiposData.success ? anticiposData.total : 0;

        const anticipoDisponible = Math.max(0, (copModelo * 0.9) - anticiposPagados);

        setProductivityData({
          copModelo,
          anticipoDisponible,
          anticiposPagados
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    // Validaciones
    if (anticipoData.monto_solicitado <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    
    if (anticipoData.monto_solicitado > productivityData.anticipoDisponible) {
      setError(`El monto no puede exceder $${productivityData.anticipoDisponible.toLocaleString('es-CO')} COP`);
      return;
    }

    if (anticipoData.medio_pago === 'nequi' || anticipoData.medio_pago === 'daviplata') {
      if (!anticipoData.nombre_beneficiario || !anticipoData.numero_telefono) {
        setError('Nombre y número son requeridos para NEQUI/DAVIPLATA');
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

      const periodDate = new Date().toISOString().split('T')[0];
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Acceso Denegado</h1>
          <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Solicitar Anticipo</h1>
          <p className="text-gray-600">Solicita un anticipo de hasta el 90% de tu productividad</p>
        </div>

        {/* Resumen de Productividad */}
        <div className="apple-card mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Resumen de Productividad</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="text-2xl font-bold text-blue-700 mb-2">
                ${productivityData.copModelo.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm font-medium text-blue-600">COP Modelo</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
              <div className="text-2xl font-bold text-green-700 mb-2">
                ${productivityData.anticipoDisponible.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm font-medium text-green-600">Anticipo Disponible</div>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
              <div className="text-2xl font-bold text-orange-700 mb-2">
                ${productivityData.anticiposPagados.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="text-sm font-medium text-orange-600">Ya Pagados</div>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div className="apple-card">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Datos del Anticipo</h2>
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-green-800 font-medium">¡Solicitud enviada correctamente!</span>
              </div>
              <p className="text-green-700 text-sm mt-1">Serás redirigido a "Mis Solicitudes" en unos segundos...</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 font-medium">Error</span>
              </div>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Monto Solicitado y Medio de Pago - Layout Horizontal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Monto Solicitado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Monto Solicitado (COP)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={anticipoData.monto_solicitado || ''}
                    onChange={(e) => handleInputChange('monto_solicitado', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="apple-input w-full pr-20"
                    min="0"
                    max={productivityData.anticipoDisponible}
                    step="1000"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-blue-600">
                    {calculatePercentage().toFixed(1)}%
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Máximo disponible: ${productivityData.anticipoDisponible.toLocaleString('es-CO')} COP
                </p>
              </div>

              {/* Medio de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Medio de Pago
                </label>
                <div className="space-y-3">
                  {['nequi', 'daviplata', 'cuenta_bancaria'].map((medio) => (
                    <label key={medio} className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="medio_pago"
                        value={medio}
                        checked={anticipoData.medio_pago === medio}
                        onChange={(e) => handleInputChange('medio_pago', e.target.value)}
                        className="mr-3 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {medio === 'cuenta_bancaria' ? 'CUENTA BANCARIA' : medio.toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Datos NEQUI/DAVIPLATA */}
            {(anticipoData.medio_pago === 'nequi' || anticipoData.medio_pago === 'daviplata') && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Datos de {anticipoData.medio_pago.toUpperCase()}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Nombre del Beneficiario
                    </label>
                    <input
                      type="text"
                      value={anticipoData.nombre_beneficiario || ''}
                      onChange={(e) => handleInputChange('nombre_beneficiario', e.target.value)}
                      placeholder="Nombre completo"
                      className="apple-input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Número de {anticipoData.medio_pago.toUpperCase()}
                    </label>
                    <input
                      type="tel"
                      value={anticipoData.numero_telefono || ''}
                      onChange={(e) => handleInputChange('numero_telefono', e.target.value)}
                      placeholder="Número de teléfono"
                      className="apple-input w-full"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Datos Cuenta Bancaria */}
            {anticipoData.medio_pago === 'cuenta_bancaria' && (
              <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-6">Datos de CUENTA BANCARIA</h3>
                
                {/* Primera fila: Nombre del Titular y Banco */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Nombre del Titular
                    </label>
                    <input
                      type="text"
                      value={anticipoData.nombre_titular || ''}
                      onChange={(e) => handleInputChange('nombre_titular', e.target.value)}
                      placeholder="Nombre completo del titular"
                      className="apple-input w-full"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Banco
                    </label>
                    <div className="relative bank-dropdown">
                      <button
                        type="button"
                        onClick={() => setIsBankDropdownOpen(!isBankDropdownOpen)}
                        className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-200 hover:border-gray-300 text-left flex items-center justify-between"
                      >
                        <span className={anticipoData.banco ? 'text-gray-900' : 'text-gray-500'}>
                          {anticipoData.banco || 'Selecciona un banco'}
                        </span>
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${isBankDropdownOpen ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isBankDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-32 overflow-y-auto">
                          <div className="py-1">
                            {bancosColombia.map((banco) => (
                              <button
                                key={banco}
                                type="button"
                                onClick={() => {
                                  handleInputChange('banco', banco);
                                  setIsBankDropdownOpen(false);
                                }}
                                className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150"
                              >
                                {banco}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banco Otros */}
                {anticipoData.banco === 'Otros' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Nombre del Banco
                    </label>
                    <input
                      type="text"
                      value={anticipoData.banco_otro || ''}
                      onChange={(e) => handleInputChange('banco_otro', e.target.value)}
                      placeholder="Escribe el nombre del banco"
                      className="apple-input w-full"
                      required
                    />
                  </div>
                )}

                {/* Segunda fila: Tipo de Cuenta y Número de Cuenta */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Tipo de Cuenta
                    </label>
                    <div className="relative account-type-dropdown">
                      <button
                        type="button"
                        onClick={() => setIsAccountTypeDropdownOpen(!isAccountTypeDropdownOpen)}
                        className="w-full px-4 py-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-200 hover:border-gray-300 text-left flex items-center justify-between"
                      >
                        <span className={anticipoData.tipo_cuenta ? 'text-gray-900' : 'text-gray-500'}>
                          {anticipoData.tipo_cuenta ? (anticipoData.tipo_cuenta === 'ahorros' ? 'Ahorros' : 'Corriente') : 'Selecciona tipo de cuenta'}
                        </span>
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${isAccountTypeDropdownOpen ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {isAccountTypeDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                          <div className="py-1">
                            {tiposCuenta.map((tipo) => (
                              <button
                                key={tipo}
                                type="button"
                                onClick={() => {
                                  handleInputChange('tipo_cuenta', tipo.toLowerCase());
                                  setIsAccountTypeDropdownOpen(false);
                                }}
                                className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors duration-150"
                              >
                                {tipo}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Número de Cuenta
                    </label>
                    <input
                      type="text"
                      value={anticipoData.numero_cuenta || ''}
                      onChange={(e) => handleInputChange('numero_cuenta', e.target.value)}
                      placeholder="Número de cuenta"
                      className="apple-input w-full"
                      required
                    />
                  </div>
                </div>

                {/* Tercera fila: Documento del Titular */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Documento del Titular
                  </label>
                  <input
                    type="text"
                    value={anticipoData.documento_titular || ''}
                    onChange={(e) => handleInputChange('documento_titular', e.target.value)}
                    placeholder="Cédula o documento de identidad"
                    className="apple-input w-full"
                    required
                  />
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-8 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || productivityData.anticipoDisponible <= 0}
                className="flex-1 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
