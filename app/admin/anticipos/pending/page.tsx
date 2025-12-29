"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import AppleDropdown from '@/components/ui/AppleDropdown';

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
  nombre_beneficiario?: string;
  numero_telefono?: string;
  nombre_titular?: string;
  banco?: string;
  banco_otro?: string;
  tipo_cuenta?: string;
  numero_cuenta?: string;
  documento_titular?: string;
  cedula_titular?: string;
  created_at: string;
  model: {
    id: string;
    name: string;
    email: string;
    groups?: Array<{
      id: string;
      name: string;
    }>;
  };
  period: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}


export default function SolicitudesPendientesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'realizado' | 'confirmado'>('todos');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [availableGroups, setAvailableGroups] = useState<Array<{id: string, name: string}>>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const router = useRouter();
  const supabase = require('@/lib/supabase').supabase;

  useEffect(() => {
    loadUser();
  }, []);

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

      if (!userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
        router.push('/login');
        return;
      }

      setUser(userData);
      await loadAnticipos(userData.id, userData.role);
    } catch (error) {
      console.error('Error loading user:', error);
      setError('Error al cargar datos del usuario');
    } finally {
      setLoading(false);
    }
  };

  const loadAnticipos = async (adminId: string, role?: string) => {
    try {
      console.log('🔍 [ADMIN] Cargando anticipos para admin:', adminId);
      // Cargar tanto pendientes como aprobadas
      const response = await fetch(`/api/anticipos?adminId=${adminId}&estado=pendiente,aprobado`);
      const data = await response.json();
      
      console.log('🔍 [ADMIN] Respuesta de la API:', data);
      
      if (data.success) {
        const anticiposData = data.anticipos || data.data || [];
        console.log('🔍 [ADMIN] Anticipos cargados:', anticiposData.length);
        setAnticipos(anticiposData);
        
        // Extraer grupos únicos de los anticipos
        const groupsSet = new Map<string, {id: string, name: string}>();
        anticiposData.forEach((anticipo: Anticipo) => {
          // Los grupos vienen anidados desde la API como user_groups.group
          if (anticipo.model.groups) {
            anticipo.model.groups.forEach((userGroup: any) => {
              const group = userGroup.group || userGroup; // Manejar ambos formatos
              if (group && group.id && group.name) {
                groupsSet.set(group.id, group);
              }
            });
          }
        });
        
        // También procesar los grupos para que estén en el formato correcto en las tarjetas
        const processedAnticipos = anticiposData.map((anticipo: Anticipo) => ({
          ...anticipo,
          model: {
            ...anticipo.model,
            groups: anticipo.model.groups?.map((userGroup: any) => 
              userGroup.group || userGroup
            ) || []
          }
        }));
        
        setAnticipos(processedAnticipos);
        const groupsFromAnticipos = Array.from(groupsSet.values());
        setAvailableGroups(groupsFromAnticipos);

        // Fallback: si es super admin y no se detectaron grupos en anticipos, cargar todas las sedes
        if ((role === 'super_admin') && groupsFromAnticipos.length === 0) {
          const { data: allGroups, error: groupsError } = await supabase
            .from('groups')
            .select('id, name')
            .order('name');
          if (!groupsError && Array.isArray(allGroups) && allGroups.length > 0) {
            setAvailableGroups(allGroups as Array<{id: string, name: string}>);
          }
        }
      } else {
        console.error('❌ [ADMIN] Error en respuesta:', data.error);
        setError(data.error || 'Error al cargar solicitudes');
      }
    } catch (error) {
      console.error('❌ [ADMIN] Error loading anticipos:', error);
      setError('Error al cargar solicitudes');
    }
  };

  // Filtrar anticipos por estado y grupo
  const getAnticiposFiltrados = () => {
    let filtered = anticipos;
    
    // Filtrar por estado
    if (estadoFiltro !== 'todos') {
      filtered = filtered.filter(anticipo => anticipo.estado === estadoFiltro);
    }
    
    // Filtrar por grupo (super admin o admin)
    if ((user?.role === 'super_admin' || user?.role === 'admin') && grupoFiltro !== 'todos') {
      filtered = filtered.filter(anticipo => 
        anticipo.model.groups?.some(group => group.id === grupoFiltro)
      );
    }
    
    return filtered;
  };

  const handleAction = async (anticipoId: string, action: 'aprobado' | 'rechazado' | 'realizado', comentarios?: string) => {
    try {
      setProcessing(anticipoId);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/anticipos/${anticipoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: action,
          comentarios_admin: action === 'aprobado' ? comentarios : undefined,
          comentarios_rechazo: action === 'rechazado' ? comentarios : undefined,
          admin_id: user?.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Solicitud ${action} correctamente`);
        // Recargar la lista
        await loadAnticipos(user?.id || '');
      } else {
        setError(data.error || `Error al ${action} solicitud`);
      }
    } catch (error) {
      console.error(`Error ${action} anticipo:`, error);
      setError(`Error al ${action} solicitud`);
    } finally {
      setProcessing(null);
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

  const getMedioPagoInfo = (anticipo: Anticipo) => {
    if (anticipo.medio_pago === 'nequi' || anticipo.medio_pago === 'daviplata') {
      return {
        tipo: anticipo.medio_pago.toUpperCase(),
        info: `${anticipo.nombre_beneficiario} - ${anticipo.numero_telefono}`
      };
    } else {
      return {
        tipo: 'Cuenta Bancaria',
        info: `${anticipo.banco || anticipo.banco_otro} - ${anticipo.tipo_cuenta} - ${anticipo.numero_cuenta}`
      };
    }
  };

  const formatDateCO = (dateString?: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const buildClipboardInfo = (anticipo: Anticipo) => {
    const medio = getMedioPagoInfo(anticipo).tipo;
    const monto = `$${(anticipo.monto_solicitado || 0).toLocaleString('es-CO')} COP`;
    const periodo = `${formatDateCO(anticipo.period?.start_date)} → ${formatDateCO(anticipo.period?.end_date)}`;
    const titular = anticipo.nombre_titular || anticipo.nombre_beneficiario || '';
    const documento = anticipo.documento_titular || anticipo.cedula_titular || '';
    const banco = anticipo.banco || anticipo.banco_otro || '';
    const tipoCuenta = anticipo.tipo_cuenta || '';
    const numeroCuenta = anticipo.numero_cuenta || '';
    const telefono = anticipo.numero_telefono || '';
    const email = anticipo.model?.email || '';
    const grupos = anticipo.model?.groups?.map((g: any) => g.name).join(', ') || '';

    const lines: string[] = [
      `Anticipo de: ${anticipo.model?.name || ''}`,
      `Monto: ${monto}`,
      `Medio: ${medio}`,
      `Periodo: ${periodo}`,
    ];
    if (titular) lines.push(`Titular: ${titular}`);
    if (documento) lines.push(`Documento: ${documento}`);
    if (banco) lines.push(`Banco: ${banco}`);
    if (tipoCuenta) lines.push(`Tipo de cuenta: ${tipoCuenta}`);
    if (numeroCuenta) lines.push(`Número de cuenta: ${numeroCuenta}`);
    if (telefono) lines.push(`Teléfono: ${telefono}`);
    if (email) lines.push(`Email: ${email}`);
    if (grupos) lines.push(`Grupo/Sede: ${grupos}`);
    return lines.join('\n');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center pt-24">
        <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/20 p-8 max-w-md">
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Acceso Denegado</h1>
            <p className="text-sm text-gray-600">No tienes permisos para acceder a esta página.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      Gestión de Solicitudes
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">Gestiona las solicitudes de anticipo de tu grupo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-4 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15 z-[99999]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtro por Grupo/Sede (super admin o admin) */}
            {(user?.role === 'super_admin' || user?.role === 'admin') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Filtrar por grupo o sede:</label>
                <AppleDropdown
                  options={[
                    { value: 'todos', label: 'Todos los grupos' },
                    ...availableGroups.map(group => ({
                      value: group.id,
                      label: group.name
                    }))
                  ]}
                  value={grupoFiltro}
                  onChange={setGrupoFiltro}
                  placeholder="Selecciona un grupo"
                  className="text-sm"
                />
              </div>
            )}
            
            {/* Filtro de Estado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {user?.role === 'super_admin' ? 'Filtrar por estado:' : 'Filtrar por estado:'}
              </label>
              <AppleDropdown
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'pendiente', label: 'Pendientes' },
                  { value: 'aprobado', label: 'Aprobadas' },
                  { value: 'realizado', label: 'Realizadas' },
                  { value: 'confirmado', label: 'Confirmadas' }
                ]}
                value={estadoFiltro}
                onChange={(value) => setEstadoFiltro(value as 'todos' | 'pendiente' | 'aprobado' | 'realizado' | 'confirmado')}
                placeholder="Selecciona un estado"
                className="text-sm"
              />
            </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 dark:text-red-300 font-medium">Error</span>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 dark:text-green-300 font-medium">Éxito</span>
            </div>
            <p className="text-green-700 dark:text-green-300 text-sm mt-1">{success}</p>
          </div>
        )}

        {/* Lista de Solicitudes */}
        {anticipos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-8 px-6">
            <svg className="w-8 h-8 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No hay solicitudes pendientes</h3>
            <p className="text-gray-500 dark:text-gray-400">Todas las solicitudes han sido procesadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {getAnticiposFiltrados().map((anticipo) => {
              const medioPagoInfo = getMedioPagoInfo(anticipo);
              
              return (
                <div key={anticipo.id} className="bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600/20 p-3 sm:p-4 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
                  <div className="space-y-2 sm:space-y-3">
                    {/* Primera línea: Modelo y monto */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate mb-1 sm:mb-0">
                          {anticipo.model.name}
                        </h3>
                        {/* Mostrar grupos del modelo de forma discreta */}
                        {anticipo.model.groups && anticipo.model.groups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {anticipo.model.groups.map((group) => (
                              <span
                                key={group.id}
                                className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded"
                              >
                                {group.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                          ${anticipo.monto_solicitado.toLocaleString('es-CO')} COP
                        </div>
                      </div>
                    </div>

                    {/* Segunda línea: Información compacta - Reorganizada para móvil */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-1 sm:gap-0 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
                        <span><span className="font-medium">Medio:</span> {medioPagoInfo.tipo}</span>
                        {anticipo.nombre_beneficiario && (
                          <span className="truncate"><span className="font-medium">Beneficiario:</span> {anticipo.nombre_beneficiario}</span>
                        )}
                        {anticipo.numero_telefono && (
                          <span><span className="font-medium">Tel:</span> {anticipo.numero_telefono}</span>
                        )}
                      </div>
                      <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                        {new Date(anticipo.created_at).toLocaleDateString('es-CO')}
                      </div>
                    </div>

                    {/* Tercera línea: Detalles plegables para transferencia */}
                    <div className="mt-1 sm:mt-2">
                      <button
                        onClick={() => setExpandedId(expandedId === anticipo.id ? null : anticipo.id)}
                        className="text-[10px] sm:text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline active:scale-95 touch-manipulation"
                      >
                        {expandedId === anticipo.id ? 'Ocultar detalles' : 'Ver detalles de transferencia'}
                      </button>
                      {expandedId === anticipo.id && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 sm:gap-y-1 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-300">
                            <div>
                              <span className="font-semibold">Método:</span> {medioPagoInfo.tipo}
                            </div>
                            <div>
                              <span className="font-semibold">Periodo:</span> {formatDateCO(anticipo.period?.start_date)} → {formatDateCO(anticipo.period?.end_date)}
                            </div>
                            {(anticipo.nombre_titular || anticipo.nombre_beneficiario) && (
                              <div>
                                <span className="font-semibold">Titular:</span> {anticipo.nombre_titular || anticipo.nombre_beneficiario}
                              </div>
                            )}
                            {(anticipo.documento_titular || anticipo.cedula_titular) && (
                              <div>
                                <span className="font-semibold">Documento:</span> {anticipo.documento_titular || anticipo.cedula_titular}
                              </div>
                            )}
                            {(anticipo.banco || anticipo.banco_otro) && (
                              <div>
                                <span className="font-semibold">Banco:</span> {anticipo.banco || anticipo.banco_otro}
                              </div>
                            )}
                            {anticipo.tipo_cuenta && (
                              <div>
                                <span className="font-semibold">Tipo de cuenta:</span> {anticipo.tipo_cuenta}
                              </div>
                            )}
                            {anticipo.numero_cuenta && (
                              <div className="break-all">
                                <span className="font-semibold">Número de cuenta:</span> {anticipo.numero_cuenta}
                              </div>
                            )}
                            {anticipo.numero_telefono && (
                              <div>
                                <span className="font-semibold">Teléfono:</span> {anticipo.numero_telefono}
                              </div>
                            )}
                            {anticipo.model?.email && (
                              <div className="sm:col-span-2">
                                <span className="font-semibold">Email modelo:</span> {anticipo.model.email}
                              </div>
                            )}
                            {anticipo.model?.groups && anticipo.model.groups.length > 0 && (
                              <div className="sm:col-span-2">
                                <span className="font-semibold">Grupo/Sede:</span> {anticipo.model.groups.map((g: any) => g.name).join(', ')}
                              </div>
                            )}
                          <div className="sm:col-span-2 mt-1.5 sm:mt-1">
                            <button
                              onClick={async () => {
                                try {
                                  const text = buildClipboardInfo(anticipo);
                                  await navigator.clipboard.writeText(text);
                                  setSuccess('Información copiada al portapapeles');
                                  setTimeout(() => setSuccess(null), 2000);
                                } catch (e) {
                                  setError('No se pudo copiar. Intenta de nuevo.');
                                  setTimeout(() => setError(null), 2000);
                                }
                              }}
                              className="w-full sm:w-auto px-2.5 sm:px-2 py-1.5 sm:py-1 text-[10px] sm:text-[11px] font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors active:scale-95 touch-manipulation"
                            >
                              Copiar información
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botones de acción compactos */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 sm:space-x-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-600">
                      {anticipo.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={() => {
                              const comentarios = prompt('Comentarios (opcional):');
                              handleAction(anticipo.id, 'aprobado', comentarios || undefined);
                            }}
                            disabled={processing === anticipo.id}
                            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md active:scale-95 touch-manipulation"
                          >
                            {processing === anticipo.id ? '...' : 'Aprobar'}
                          </button>
                          
                          <button
                            onClick={() => {
                              const comentarios = prompt('Motivo del rechazo:');
                              if (comentarios) {
                                handleAction(anticipo.id, 'rechazado', comentarios);
                              }
                            }}
                            disabled={processing === anticipo.id}
                            className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md active:scale-95 touch-manipulation"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      
                      {anticipo.estado === 'aprobado' && (
                        <button
                          onClick={() => {
                            const confirmar = confirm('¿Confirmas que el anticipo ha sido realizado/pagado?');
                            if (confirmar) {
                              handleAction(anticipo.id, 'realizado');
                            }
                          }}
                          disabled={processing === anticipo.id}
                          className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-xs font-medium bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md active:scale-95 touch-manipulation"
                        >
                          {processing === anticipo.id ? '...' : 'Realizado'}
                        </button>
                      )}

                      {anticipo.estado === 'realizado' && (
                        <div className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium text-center sm:text-left">
                          Esperando confirmación de la modelo
                        </div>
                      )}

                      {anticipo.estado === 'confirmado' && (
                        <div className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium text-center sm:text-left">
                          Confirmado por la modelo
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Elemento decorativo para historial */}
        <div className="mt-6 text-center">
          <div className="px-6 py-3 bg-gray-600 dark:bg-gray-700 text-white rounded-xl hover:bg-gray-700 dark:hover:bg-gray-600 transition-all duration-200 font-medium shadow-sm cursor-default inline-block">
            Ver Historial
          </div>
        </div>
      </div>
    </div>
  );
}
