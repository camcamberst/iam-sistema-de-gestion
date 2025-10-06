"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { InfoCardGrid } from '@/components/ui/InfoCard';
import AppleDropdown from '@/components/AppleSelect';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Anticipo {
  id: string;
  monto_solicitado: number;
  porcentaje_solicitado: number;
  medio_pago: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'realizado' | 'confirmado' | 'cancelado';
  comentarios_admin?: string;
  comentarios_rechazo?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  realized_at?: string;
  cancelled_at?: string;
  // Datos de transferencia
  nombre_beneficiario?: string;
  banco?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  cedula_titular?: string;
  model: {
    id: string;
    name: string;
    email: string;
    group_id?: string;
    group?: {
      id: string;
      name: string;
    };
  };
  period: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

export default function HistorialAnticiposPage() {
  console.log('🔍 [COMPONENT] HistorialAnticiposPage se está ejecutando');
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [filteredAnticipos, setFilteredAnticipos] = useState<Anticipo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    modelo: '',
    mes: '',
    periodo: '',
    grupo: ''
  });
  const [grupos, setGrupos] = useState<Array<{id: string, name: string}>>([]);
  const [isGrupoDropdownOpen, setIsGrupoDropdownOpen] = useState(false);
  const [modelosPorGrupo, setModelosPorGrupo] = useState<Record<string, string[]>>({});
  
  // Estados para estadísticas dinámicas
  const [stats, setStats] = useState({
    totalSolicitudes: 0,
    realizados: 0,
    pendientes: 0,
    totalPagado: 0
  });
  const [showPendientes, setShowPendientes] = useState(false);

  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  useEffect(() => {
    console.log('🔍 [USE EFFECT] Ejecutando useEffect inicial');
    loadUser();
  }, []);

  useEffect(() => {
    console.log('🔍 [USE EFFECT] Aplicando filtros automáticamente:', {
      anticipos: anticipos.length,
      filters: filters
    });
    applyFilters();
  }, [anticipos, filters]);

  // Dropdown ahora se controla solo con hover, no necesita click-outside

  const loadUser = async () => {
    try {
      console.log('🔍 [LOAD USER] Iniciando carga de usuario...');
      setLoading(true);
      
      const { data: auth } = await supabase.auth.getUser();
      console.log('🔍 [LOAD USER] Auth data:', auth);
      
      if (!auth?.user) {
        console.log('🔍 [LOAD USER] No hay usuario autenticado, redirigiendo a login');
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('id', auth.user.id)
        .single();

      console.log('🔍 [LOAD USER] User data:', userData);

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        console.log('🔍 [LOAD USER] Usuario no autorizado, redirigiendo a login');
        router.push('/login');
        return;
      }

      setUser(userData);
      console.log('🔍 [LOAD USER] Usuario establecido, cargando anticipos...');
      await loadAnticipos(userData.id);
      
      // Cargar grupos si es super admin
      if (userData.role === 'super_admin') {
        console.log('🔍 [LOAD USER] Es super admin, cargando grupos...');
        await loadGrupos();
      }
    } catch (error) {
      console.error('🔍 [LOAD USER] Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      console.log('🔍 [LOAD USER] Finalizando carga de usuario');
      setLoading(false);
    }
  };

  const loadAnticipos = async (adminId: string) => {
    try {
      console.log('🔍 [CARGAR ANTICIPOS] Cargando anticipos para admin:', adminId);
      
      const url = `/api/anticipos?adminId=${adminId}`;
      console.log('🔍 [CARGAR ANTICIPOS] URL:', url);
      
      const response = await fetch(url);
      console.log('🔍 [CARGAR ANTICIPOS] Response status:', response.status);
      console.log('🔍 [CARGAR ANTICIPOS] Response ok:', response.ok);
      
      const data = await response.json();
      console.log('🔍 [CARGAR ANTICIPOS] Respuesta API completa:', data);
      
      if (data.success) {
        const anticiposData = data.anticipos || data.data || [];
        console.log('🔍 [CARGAR ANTICIPOS] Anticipos cargados:', anticiposData.length);
        console.log('🔍 [CARGAR ANTICIPOS] Detalles anticipos:', anticiposData);
        console.log('🔍 [CARGAR ANTICIPOS] Tipo de anticipos:', typeof anticiposData);
        console.log('🔍 [CARGAR ANTICIPOS] Es array:', Array.isArray(anticiposData));
        if (anticiposData && anticiposData.length > 0) {
          console.log('🔍 [CARGAR ANTICIPOS] Primer anticipo:', anticiposData[0]);
          console.log('🔍 [CARGAR ANTICIPOS] Estados de anticipos:', anticiposData.map((a: any) => a.estado));
        }
        setAnticipos(anticiposData);
        calculateStats(anticiposData);
      } else {
        console.error('🔍 [CARGAR ANTICIPOS] Error en API:', data.error);
        setError(data.error || 'Error al cargar historial');
      }
    } catch (error) {
      console.error('🔍 [CARGAR ANTICIPOS] Error en fetch:', error);
      setError('Error al cargar historial');
    }
  };

  const calculateStats = (anticiposData: Anticipo[]) => {
    console.log('🔍 [ESTADÍSTICAS] Calculando estadísticas para:', anticiposData.length, 'anticipos');
    
    const totalSolicitudes = anticiposData.length;
    const realizados = anticiposData.filter(a => a.estado === 'realizado' || a.estado === 'confirmado').length;
    const pendientes = anticiposData.filter(a => a.estado === 'pendiente' || a.estado === 'aprobado').length;
    const totalPagado = anticiposData
      .filter(a => a.estado === 'realizado' || a.estado === 'confirmado')
      .reduce((sum, a) => sum + a.monto_solicitado, 0);

    console.log('🔍 [ESTADÍSTICAS] Resultados:', {
      totalSolicitudes,
      realizados,
      pendientes,
      totalPagado
    });

    setStats({
      totalSolicitudes,
      realizados,
      pendientes,
      totalPagado
    });
  };

  const handlePendientesClick = () => {
    console.log('🔍 [BOTÓN PENDIENTES] Mostrando anticipos pendientes');
    setShowPendientes(!showPendientes);
    
    if (!showPendientes) {
      // Filtrar solo anticipos pendientes
      const pendientes = anticipos.filter(a => a.estado === 'pendiente' || a.estado === 'aprobado');
      setFilteredAnticipos(pendientes);
    } else {
      // Volver a aplicar filtros normales
      applyFilters();
    }
  };

  const loadGrupos = async () => {
    try {
      console.log('🔍 [CARGAR GRUPOS] Iniciando carga de grupos...');
      
      const { data: gruposData } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');
      
      console.log('🔍 [CARGAR GRUPOS] Grupos obtenidos:', gruposData);
      
      if (gruposData) {
        setGrupos(gruposData);
        
        // Cargar modelos por grupo
        const modelosPorGrupoData: Record<string, string[]> = {};
        
        for (const grupo of gruposData) {
          console.log('🔍 [CARGAR GRUPOS] Cargando modelos para grupo:', grupo.name);
          
          const { data: modelosData } = await supabase
            .from('user_groups')
            .select('user_id')
            .eq('group_id', grupo.id);
          
          console.log('🔍 [CARGAR GRUPOS] Modelos del grupo', grupo.name, ':', modelosData);
          
          if (modelosData) {
            modelosPorGrupoData[grupo.id] = modelosData.map(m => m.user_id);
          }
        }
        
        console.log('🔍 [CARGAR GRUPOS] Modelos por grupo final:', modelosPorGrupoData);
        setModelosPorGrupo(modelosPorGrupoData);
      }
    } catch (error) {
      console.error('Error loading grupos:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...anticipos];

    console.log('🔍 [FILTROS] Aplicando filtros:', {
      totalAnticipos: anticipos.length,
      filtros: filters,
      userRole: user?.role,
      modelosPorGrupo: modelosPorGrupo
    });

    // Si no hay anticipos, no aplicar filtros
    if (anticipos.length === 0) {
      console.log('🔍 [FILTROS] No hay anticipos para filtrar');
      setFilteredAnticipos([]);
      return;
    }

    // Filtrar por grupo (solo para super_admin)
    if (user?.role === 'super_admin' && filters.grupo) {
      console.log('🔍 [FILTROS] Filtrando por grupo:', filters.grupo);
      filtered = filtered.filter(anticipo => {
        // Obtener el group_id del primer grupo de la modelo
        const modelGroupId = anticipo.model.user_groups?.[0]?.group_id;
        const matches = modelGroupId === filters.grupo;
        console.log('🔍 [FILTROS] Anticipo:', {
          id: anticipo.id,
          modelGroupId,
          filterGrupo: filters.grupo,
          matches,
          userGroups: anticipo.model.user_groups
        });
        return matches;
      });
      console.log('🔍 [FILTROS] Después de grupo:', filtered.length);
    }

    // Filtrar por modelo
    if (filters.modelo) {
      filtered = filtered.filter(anticipo => 
        anticipo.model.name.toLowerCase().includes(filters.modelo.toLowerCase()) ||
        anticipo.model.email.toLowerCase().includes(filters.modelo.toLowerCase())
      );
      console.log('🔍 [FILTROS] Después de modelo:', filtered.length);
    }

    // Filtrar por mes
    if (filters.mes) {
      const monthNames = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
        'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
      };
      const targetMonth = monthNames[filters.mes as keyof typeof monthNames];
      console.log('🔍 [FILTROS] Filtrando por mes:', { mes: filters.mes, targetMonth });
      filtered = filtered.filter(anticipo => {
        const anticipoDate = new Date(anticipo.created_at);
        const anticipoMonth = anticipoDate.getMonth();
        const matches = anticipoMonth === targetMonth;
        console.log('🔍 [FILTROS] Anticipo mes:', {
          id: anticipo.id,
          created_at: anticipo.created_at,
          anticipoMonth,
          targetMonth,
          matches
        });
        return matches;
      });
      console.log('🔍 [FILTROS] Después de mes:', filtered.length);
    }

    // Filtrar por período
    if (filters.periodo) {
      console.log('🔍 [FILTROS] Filtrando por período:', filters.periodo);
      if (filters.periodo === 'periodo-1') {
        // Periodo 1: días 1-15
        filtered = filtered.filter(anticipo => {
          const date = new Date(anticipo.created_at);
          const day = date.getDate();
          const matches = day >= 1 && day <= 15;
          console.log('🔍 [FILTROS] Anticipo período 1:', {
            id: anticipo.id,
            created_at: anticipo.created_at,
            day,
            matches
          });
          return matches;
        });
      } else if (filters.periodo === 'periodo-2') {
        // Periodo 2: días 16-fin de mes
        filtered = filtered.filter(anticipo => {
          const date = new Date(anticipo.created_at);
          const day = date.getDate();
          const matches = day >= 16;
          console.log('🔍 [FILTROS] Anticipo período 2:', {
            id: anticipo.id,
            created_at: anticipo.created_at,
            day,
            matches
          });
          return matches;
        });
      }
      console.log('🔍 [FILTROS] Después de período:', filtered.length);
    }


    console.log('🔍 [FILTROS] Resultado final:', filtered.length);
    setFilteredAnticipos(filtered);
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'aprobado':
        return 'bg-blue-100 text-blue-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      case 'realizado':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'aprobado':
        return 'Aprobado';
      case 'rechazado':
        return 'Rechazado';
      case 'realizado':
        return 'Realizado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return estado;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadisticas = () => {
    const total = anticipos.length;
    const realizados = anticipos.filter(a => a.estado === 'realizado').length;
    const pendientes = anticipos.filter(a => a.estado === 'pendiente').length;
    const rechazados = anticipos.filter(a => a.estado === 'rechazado').length;
    const cancelados = anticipos.filter(a => a.estado === 'cancelado').length;
    
    const montoTotal = anticipos.reduce((sum, a) => sum + a.monto_solicitado, 0);
    const montoRealizado = anticipos
      .filter(a => a.estado === 'realizado')
      .reduce((sum, a) => sum + a.monto_solicitado, 0);

    return {
      total,
      realizados,
      pendientes,
      rechazados,
      cancelados,
      montoTotal,
      montoRealizado
    };
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

  const estadisticas = getEstadisticas();

  return (
    <div className="min-h-screen bg-white">
      <style jsx>{`
        /* Estilos Apple para dropdowns con altura limitada */
        .bank-select {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          max-height: 120px !important;
          overflow-y: auto;
        }
        .bank-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          outline: none;
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
        .bank-select option {
          padding: 8px 12px;
          background: white;
          color: #374151;
          font-size: 14px;
          line-height: 1.4;
          border-radius: 4px;
          margin: 1px 2px;
        }
        .bank-select option:hover {
          background: #f3f4f6;
        }
        .bank-select option:checked {
          background: #3b82f6;
          color: white;
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Historial de Anticipos</h1>
          <p className="text-gray-600">Gestiona el historial completo de anticipos de tu grupo</p>
        </div>

        {/* Error Message */}
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

        {/* Estadísticas con InfoCardGrid */}
        <InfoCardGrid 
          cards={[
            {
              value: stats.totalSolicitudes,
              label: 'Total Solicitudes',
              color: 'blue'
            },
            {
              value: stats.realizados,
              label: 'Realizados',
              color: 'green'
            },
            {
              value: stats.pendientes,
              label: showPendientes ? 'Ocultar Pendientes' : 'Ver Pendientes',
              color: 'yellow',
              onClick: handlePendientesClick,
              clickable: true
            },
            {
              value: `$${stats.totalPagado.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              label: 'Total Pagado (COP)',
              color: 'green'
            }
          ]}
          columns={4}
          className="mb-8"
        />

        {/* Filtros */}
        <div className="apple-card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. Grupo (primero) */}
            {user?.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Grupo</label>
                <AppleDropdown
                  options={[
                    { value: '', label: 'Todos los grupos' },
                    ...grupos.map(g => ({ value: g.id, label: g.name }))
                  ]}
                  value={filters.grupo}
                  onChange={(value) => setFilters(prev => ({ ...prev, grupo: value }))}
                  placeholder="Seleccionar grupo"
                />
              </div>
            )}
            
            {/* 2. Mes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
              <AppleDropdown
                options={[
                  { value: '', label: 'Todos los meses' },
                  { value: 'enero', label: 'Enero' },
                  { value: 'febrero', label: 'Febrero' },
                  { value: 'marzo', label: 'Marzo' },
                  { value: 'abril', label: 'Abril' },
                  { value: 'mayo', label: 'Mayo' },
                  { value: 'junio', label: 'Junio' },
                  { value: 'julio', label: 'Julio' },
                  { value: 'agosto', label: 'Agosto' },
                  { value: 'septiembre', label: 'Septiembre' },
                  { value: 'octubre', label: 'Octubre' },
                  { value: 'noviembre', label: 'Noviembre' },
                  { value: 'diciembre', label: 'Diciembre' }
                ]}
                value={filters.mes}
                onChange={(value) => setFilters(prev => ({ ...prev, mes: value }))}
                placeholder="Seleccionar mes"
              />
            </div>
            
            {/* 3. Periodo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Periodo</label>
              <AppleDropdown
                options={[
                  { value: '', label: 'Todos los periodos' },
                  { value: 'periodo-1', label: 'Periodo 1' },
                  { value: 'periodo-2', label: 'Periodo 2' }
                ]}
                value={filters.periodo}
                onChange={(value) => setFilters(prev => ({ ...prev, periodo: value }))}
                placeholder="Seleccionar periodo"
              />
            </div>
            
            {/* 4. Modelo (búsqueda con sugerencias) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
              <input
                type="text"
                value={filters.modelo}
                onChange={(e) => setFilters(prev => ({ ...prev, modelo: e.target.value }))}
                placeholder="Buscar por nombre o email"
                className="apple-input w-full"
                list="modelos-suggestions"
              />
              <datalist id="modelos-suggestions">
                {anticipos
                  .filter(anticipo => 
                    anticipo.model.name.toLowerCase().includes(filters.modelo.toLowerCase()) ||
                    anticipo.model.email.toLowerCase().includes(filters.modelo.toLowerCase())
                  )
                  .slice(0, 10)
                  .map((anticipo, index) => (
                    <option key={index} value={anticipo.model.name} />
                  ))
                }
              </datalist>
            </div>
          </div>
        </div>

        {/* Lista de Anticipos */}
        {filteredAnticipos.length === 0 ? (
          <div className="apple-card text-center py-12">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay anticipos</h3>
            <p className="text-gray-500">
              {anticipos.length === 0 
                ? 'Aún no hay anticipos en el sistema'
                : 'No se encontraron anticipos con los filtros aplicados'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnticipos.map((anticipo) => (
              <div key={anticipo.id} className="apple-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/* Primera línea: Modelo, monto y estado */}
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {anticipo.model.name}
                        </h3>
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Email:</span> {anticipo.model.email} | 
                          <span className="font-medium ml-1">Grupo:</span> {anticipo.model.group?.name || 'Sin grupo'}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="text-base font-bold text-gray-900">
                            ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(anticipo.estado)}`}>
                          {getEstadoLabel(anticipo.estado)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Segunda línea: Información compacta con datos de transferencia */}
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center space-x-3">
                        {anticipo.nombre_beneficiario && <span><span className="font-medium">Beneficiario:</span> {anticipo.nombre_beneficiario}</span>}
                        <span><span className="font-medium">Medio:</span> {anticipo.medio_pago.toUpperCase()}</span>
                        {anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata' ? (
                          anticipo.numero_telefono && <span><span className="font-medium">Tel:</span> {anticipo.numero_telefono}</span>
                        ) : (
                          anticipo.banco && anticipo.numero_cuenta && (
                            <>
                              <span><span className="font-medium">Banco:</span> {anticipo.banco}</span>
                              <span><span className="font-medium">Cuenta:</span> {anticipo.numero_cuenta}</span>
                            </>
                          )
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(anticipo.created_at).toLocaleDateString('es-CO')}
                      </div>
                    </div>

                    {/* Comentarios - solo si existen */}
                    {anticipo.comentarios_admin && (
                      <div className="mt-1 p-1 bg-blue-50 rounded text-xs text-blue-800">
                        <span className="font-medium">Admin:</span> {anticipo.comentarios_admin}
                      </div>
                    )}

                    {anticipo.comentarios_rechazo && (
                      <div className="mt-1 p-1 bg-red-50 rounded text-xs text-red-800">
                        <span className="font-medium">Rechazo:</span> {anticipo.comentarios_rechazo}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Elementos decorativos de navegación */}
        <div className="mt-8 flex justify-center space-x-4">
          <div className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 cursor-default">
            Solicitudes Pendientes
          </div>
        </div>
      </div>
    </div>
  );
}
