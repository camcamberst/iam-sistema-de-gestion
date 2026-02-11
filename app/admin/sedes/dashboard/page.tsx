'use client';

import { useState, useEffect } from 'react';
import BillingSummary from '../../../../components/BillingSummary';
import AnnouncementManager from '../../../../components/AnnouncementManager';
import ManualPeriodClosure from '../../../../components/ManualPeriodClosure';
import { getColombiaDate } from '@/utils/calculator-dates';

interface DashboardStats {
  totalSedes: number;
  totalRooms: number;
  totalModelos: number;
  asignacionesActivas: number;
  sedesConRooms: number;
  sedesSinRooms: number;
}

interface SedeDisponibilidad {
  sede_id: string;
  sede_nombre: string;
  rooms_disponibles: number;
  rooms_totales: number;
  jornadas_disponibles: {
    manana: number;
    tarde: number;
    noche: number;
  };
  jornadas_dobladas: {
    manana: number;
    tarde: number;
    noche: number;
  };
  total_espacios: number;
}

/** Por cada room: si en esa jornada hay al menos un espacio (máx 2 modelos por room+jornada). */
interface RoomJornadaDisponibilidad {
  room_id: string;
  room_name: string;
  manana: boolean;
  tarde: boolean;
  noche: boolean;
}

/** Fila para la tabla "todas las sedes": sede + room + jornadas. */
interface FilaDisponibilidadSede {
  sede_id: string;
  sede_nombre: string;
  room_id: string;
  room_name: string;
  manana: boolean;
  tarde: boolean;
  noche: boolean;
}

interface Group {
  id: string;
  name: string;
  is_manager: boolean;
}

interface Room {
  id: string;
  room_name: string;
  group_id: string;
  is_active: boolean;
  groups: {
    id: string;
    name: string;
  };
}

export default function DashboardSedesPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSedes: 0,
    totalRooms: 0,
    totalModelos: 0,
    asignacionesActivas: 0,
    sedesConRooms: 0,
    sedesSinRooms: 0
  });
  
  // Estados para consulta de períodos históricos
  const [showHistoricalQuery, setShowHistoricalQuery] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('P1');
  const [targetDate, setTargetDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>('');
  
  // Estados para resumen de disponibilidad
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [sedeDisponibilidad, setSedeDisponibilidad] = useState<SedeDisponibilidad | null>(null);
  const [disponibilidadPorRoom, setDisponibilidadPorRoom] = useState<RoomJornadaDisponibilidad[]>([]);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const [availableSedes, setAvailableSedes] = useState<Group[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  // Ver todas las sedes en una sola tabla
  const [showTodasSedes, setShowTodasSedes] = useState(false);
  const [disponibilidadTodasSedes, setDisponibilidadTodasSedes] = useState<FilaDisponibilidadSede[]>([]);
  const [loadingTodasSedes, setLoadingTodasSedes] = useState(false);
  // Asignaciones activas desde modelo_assignments (fuente de verdad para ocupación)
  const [allAssignmentsFromApi, setAllAssignmentsFromApi] = useState<{ room_id: string; group_id: string; jornada: string; model_id?: string }[]>([]);
  // Asignaciones desde room_assignments (combinar con modelo_assignments por si los datos están en una u otra tabla)
  const [allRoomAssignmentsFromApi, setAllRoomAssignmentsFromApi] = useState<{ room_id: string; jornada: string; model_id: string }[]>([]);

  // Estados para editar RATES de cierre
  const [showEditRatesModal, setShowEditRatesModal] = useState(false);
  const [loadingPeriodInfo, setLoadingPeriodInfo] = useState(false);
  const [periodInfo, setPeriodInfo] = useState<{
    records_count: number;
    current_rates: { eur_usd: number | null; gbp_usd: number | null; usd_cop: number | null };
  } | null>(null);
  const [editRates, setEditRates] = useState<{ eur_usd: string; gbp_usd: string; usd_cop: string }>({
    eur_usd: '',
    gbp_usd: '',
    usd_cop: ''
  });
  const [savingRates, setSavingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);

  // Funciones para consulta histórica
  const getMonthName = (month: string) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[parseInt(month) - 1] || '';
  };

  const calculateTargetDate = () => {
    if (!selectedMonth || !selectedYear) return;

    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    
    let day: number;
    if (selectedPeriod === 'P1') {
      day = 15; // Período 1: día 15
    } else {
      // Período 2: último día del mes
      day = new Date(year, month, 0).getDate();
    }

    const targetDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setTargetDate(targetDateStr);
  };

  useEffect(() => {
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();

    // Manejar errores de extensiones del navegador (inofensivos)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || '';
      // Silenciar errores conocidos de extensiones del navegador
      if (
        errorMessage.includes('message channel closed') ||
        errorMessage.includes('listener indicated an asynchronous response') ||
        errorMessage.includes('Extension context invalidated')
      ) {
        event.preventDefault(); // Prevenir que se muestre en la consola
        console.debug('Error de extensión del navegador silenciado:', errorMessage);
        return;
      }
      // Permitir que otros errores se muestren normalmente
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear && selectedPeriod) {
      calculateTargetDate();
    }
  }, [selectedMonth, selectedYear, selectedPeriod]);

  // Scroll automático cuando se abre un dropdown
  useEffect(() => {
    if (dropdownOpen) {
      setTimeout(() => {
        const dropdownElement = document.querySelector('.dropdown-container');
        if (dropdownElement) {
          dropdownElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 100);
    }
  }, [dropdownOpen]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    if (!dropdownOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      try {
        const target = event.target as Element;
        if (dropdownOpen && !target.closest('.dropdown-container')) {
          setDropdownOpen(null);
        }
      } catch (error) {
        // Silenciar errores de extensiones del navegador
        console.debug('Error en handleClickOutside (probablemente extensión del navegador):', error);
      }
    };

    // Usar capture phase para mejor compatibilidad
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
    };
  }, [dropdownOpen]);


  // Cargar datos del dashboard después de cargar la información del usuario
  useEffect(() => {
    if (userRole && userGroups.length >= 0) {
      loadDashboardData();
    }
  }, [userRole, userGroups]);

  // Cargar disponibilidad cuando se seleccione una sede (y cuando lleguen las asignaciones)
  useEffect(() => {
    if (selectedSede && availableSedes.length > 0) {
      loadSedeDisponibilidad(selectedSede);
    }
  }, [selectedSede, availableSedes, allAssignmentsFromApi, allRoomAssignmentsFromApi]);

  const loadUserInfo = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserRole(parsed.role || 'admin');
        setUserGroups(parsed.groups?.map((g: any) => g.id) || []);
        setUserId(parsed.id || '');
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
    }
  };

  // Función para cargar información del período
  const loadPeriodInfo = async (periodDate: string, periodType: string) => {
    try {
      setLoadingPeriodInfo(true);
      setRatesError(null);

      // Obtener token de autenticación
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = (await import('@/lib/supabase')).supabase;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setRatesError('Sesión no válida');
        return;
      }

      const response = await fetch(`/api/admin/calculator-history/update-period-rates?period_date=${periodDate}&period_type=${periodType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!data.success) {
        setRatesError(data.error || 'Error al cargar información del período');
        return;
      }

      setPeriodInfo(data);
      
      // Prellenar formulario con tasas actuales
      setEditRates({
        eur_usd: data.current_rates?.eur_usd?.toString() || '',
        gbp_usd: data.current_rates?.gbp_usd?.toString() || '',
        usd_cop: data.current_rates?.usd_cop?.toString() || ''
      });

    } catch (err: any) {
      console.error('Error cargando información del período:', err);
      setRatesError(err.message || 'Error al cargar información del período');
    } finally {
      setLoadingPeriodInfo(false);
    }
  };

  // Función para guardar las tasas
  const savePeriodRates = async () => {
    if (!selectedMonth || !selectedYear || !selectedPeriod) return;

    try {
      setSavingRates(true);
      setRatesError(null);

      // Calcular period_date y period_type
      // IMPORTANTE: El period_date debe ser la fecha de INICIO del período
      // (día 1 para P1, día 16 para P2), igual que cuando se archivan los registros
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth);
      const periodType = selectedPeriod === 'P1' ? '1-15' : '16-31';
      
      let day: number;
      if (selectedPeriod === 'P1') {
        day = 1; // Fecha de inicio del período P1 (1-15)
      } else {
        day = 16; // Fecha de inicio del período P2 (16-31)
      }
      const periodDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      // Obtener token de autenticación
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = (await import('@/lib/supabase')).supabase;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setRatesError('Sesión no válida');
        return;
      }

      // Obtener información del usuario
      const userData = localStorage.getItem('user');
      let adminName = 'Desconocido';
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          adminName = parsed.name || parsed.email || 'Desconocido';
        } catch (e) {
          // Ignorar error de parsing
        }
      }

      const response = await fetch('/api/admin/calculator-history/update-period-rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period_date: periodDate,
          period_type: periodType,
          rates: {
            eur_usd: editRates.eur_usd ? Number(editRates.eur_usd) : undefined,
            gbp_usd: editRates.gbp_usd ? Number(editRates.gbp_usd) : undefined,
            usd_cop: editRates.usd_cop ? Number(editRates.usd_cop) : undefined
          },
          admin_id: userId,
          admin_name: adminName
        })
      });

      const data = await response.json();

      if (!data.success) {
        setRatesError(data.error || 'Error al actualizar tasas');
        return;
      }

      // Éxito: cerrar modal y recargar datos
      setShowEditRatesModal(false);
      setRatesError(null);
      
      // Mostrar notificación de éxito
      alert(`✅ Tasas actualizadas exitosamente para ${data.updated_count} registros del período ${periodDate} (${periodType})`);
      
      // Recargar la página para actualizar los datos mostrados
      window.location.reload();

    } catch (err: any) {
      console.error('Error guardando tasas:', err);
      setRatesError(err.message || 'Error al guardar tasas');
    } finally {
      setSavingRates(false);
    }
  };

  const loadSedeDisponibilidad = async (sedeId: string) => {
    if (!sedeId) {
      setSedeDisponibilidad(null);
      setDisponibilidadPorRoom([]);
      return;
    }

    try {
      setLoadingDisponibilidad(true);
      console.log('🔍 [DASHBOARD] Cargando disponibilidad para sede:', sedeId);

      // Obtener rooms de la sede
      const roomsResponse = await fetch('/api/groups/rooms');
      const roomsData = await roomsResponse.json();
      
      if (!roomsData.success) {
        throw new Error('Error obteniendo rooms');
      }

      const sedeRooms = roomsData.rooms.filter((room: Room) => room.group_id === sedeId);
      console.log('🔍 [DASHBOARD] Rooms de la sede:', sedeRooms.length);

      // Fuente única: room_assignments (donde se guarda al crear modelo y asignar room+jornada)
      const sedeRoomIds = new Set(sedeRooms.map((r: Room) => r.id));
      const getCountForRoom = (roomId: string) => {
        const count = { MAÑANA: 0, TARDE: 0, NOCHE: 0 };
        ['MAÑANA', 'TARDE', 'NOCHE'].forEach(j => {
          const enJornada = allRoomAssignmentsFromApi.filter(a => a.room_id === roomId && a.jornada === j);
          count[j as keyof typeof count] = enJornada.length;
        });
        return count;
      };

      // Disponibilidad por room y jornada: máximo 2 modelos por room+jornada → disponible si count < 2
      const porRoom: RoomJornadaDisponibilidad[] = sedeRooms.map((room: Room) => {
        const count = getCountForRoom(room.id);
        return {
          room_id: room.id,
          room_name: room.room_name,
          manana: count['MAÑANA'] < 2,
          tarde: count['TARDE'] < 2,
          noche: count['NOCHE'] < 2
        };
      });
      setDisponibilidadPorRoom(porRoom);

      // Resumen por jornada (solo room_assignments)
      const assignmentsSedeRoom = allRoomAssignmentsFromApi.filter(a => sedeRoomIds.has(a.room_id));
      const jornadas = ['MAÑANA', 'TARDE', 'NOCHE'];
      const jornadasDisponibles = { manana: 0, tarde: 0, noche: 0 };
      const jornadasDobladas = { manana: 0, tarde: 0, noche: 0 };

      jornadas.forEach((jornada, index) => {
        const jornadaKey = index === 0 ? 'manana' : index === 1 ? 'tarde' : 'noche';
        const enJornada = assignmentsSedeRoom.filter(a => a.jornada === jornada);
        const ocupados = Math.min(enJornada.length, sedeRooms.length * 2);
        jornadasDisponibles[jornadaKey] = Math.max(0, sedeRooms.length * 2 - ocupados);
        jornadasDobladas[jornadaKey] = Math.max(0, enJornada.length - sedeRooms.length);
      });

      // Obtener información de la sede
      const sedeInfo = availableSedes.find(sede => sede.id === sedeId);
      
      const disponibilidad: SedeDisponibilidad = {
        sede_id: sedeId,
        sede_nombre: sedeInfo?.name || 'Sede Desconocida',
        rooms_disponibles: sedeRooms.filter((room: Room) => room.is_active).length,
        rooms_totales: sedeRooms.length,
        jornadas_disponibles: jornadasDisponibles,
        jornadas_dobladas: jornadasDobladas,
        total_espacios: sedeRooms.length * 3 // 3 jornadas por room
      };

      setSedeDisponibilidad(disponibilidad);
      console.log('✅ [DASHBOARD] Disponibilidad calculada:', disponibilidad);

    } catch (error) {
      console.error('❌ [DASHBOARD] Error cargando disponibilidad:', error);
      setError('Error cargando disponibilidad de la sede');
    } finally {
      setLoadingDisponibilidad(false);
    }
  };

  const loadTodasSedesDisponibilidad = async () => {
    if (!availableSedes.length) return;
    try {
      setLoadingTodasSedes(true);
      setDisponibilidadTodasSedes([]);
      const roomsResponse = await fetch('/api/groups/rooms');
      const roomsData = await roomsResponse.json();
      if (!roomsData.success) throw new Error('Error obteniendo rooms');
      const allRooms = (roomsData.rooms || []) as Room[];
      const rows: FilaDisponibilidadSede[] = [];
      const getCountForRoom = (roomId: string) => {
        const count = { MAÑANA: 0, TARDE: 0, NOCHE: 0 };
        ['MAÑANA', 'TARDE', 'NOCHE'].forEach(j => {
          count[j as keyof typeof count] = allRoomAssignmentsFromApi.filter(a => a.room_id === roomId && a.jornada === j).length;
        });
        return count;
      };
      for (const sede of availableSedes) {
        const sedeRooms = allRooms.filter((r: Room) => r.group_id === sede.id);
        if (sedeRooms.length === 0) continue;
        sedeRooms.forEach((room: Room) => {
          const count = getCountForRoom(room.id);
          rows.push({
            sede_id: sede.id,
            sede_nombre: sede.name,
            room_id: room.id,
            room_name: room.room_name,
            manana: count['MAÑANA'] < 2,
            tarde: count['TARDE'] < 2,
            noche: count['NOCHE'] < 2
          });
        });
      }
      setDisponibilidadTodasSedes(rows);
    } catch (error) {
      console.error('Error cargando disponibilidad de todas las sedes:', error);
      setError('Error cargando disponibilidad de todas las sedes');
    } finally {
      setLoadingTodasSedes(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos reales desde la API con filtrado por rol
      const [groupsResponse, roomsResponse, usersResponse, assignmentsResponse, roomAssignmentsAllResponse] = await Promise.all([
        fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userRole, userGroups })
        }),
        fetch('/api/groups/rooms'),
        fetch('/api/users'),
        fetch('/api/assignments/all'),
        fetch('/api/room-assignments')
      ]);

      const [groupsData, roomsData, usersData, assignmentsData, roomAssignmentsAllData] = await Promise.all([
        groupsResponse.json(),
        roomsResponse.json(),
        usersResponse.json(),
        assignmentsResponse.json(),
        roomAssignmentsAllResponse.json()
      ]);

      // Filtrar datos según el rol del usuario
      let filteredGroups = groupsData.success ? groupsData.groups || [] : [];
      let filteredRooms = roomsData.success ? roomsData.rooms || [] : [];
      let filteredAssignments = assignmentsData.success ? assignmentsData.assignments || [] : [];

      // Si es admin (no super_admin ni superadmin_aff), filtrar por sus grupos
      if (userRole !== 'super_admin' && userRole !== 'superadmin_aff' && userGroups.length > 0) {
        filteredRooms = filteredRooms.filter((room: any) => userGroups.includes(room.group_id));
        filteredAssignments = filteredAssignments.filter((assignment: any) => userGroups.includes(assignment.group_id));
      }

      // Filtrar sedes operativas (excluir Otros y Satélites) para el dropdown
      const sedesOperativas = filteredGroups.filter((group: any) => 
        group.name !== 'Otros' && 
        group.name !== 'Satélites'
      );
      setAvailableSedes(sedesOperativas);
      // Guardar asignaciones para Consultar Disponibilidad (modelo_assignments + room_assignments)
      setAllAssignmentsFromApi((filteredAssignments as { room_id: string; group_id: string; jornada: string; model_id?: string }[]).map(a => ({
        room_id: a.room_id,
        group_id: a.group_id,
        jornada: a.jornada,
        model_id: a.model_id
      })));
      const roomAssignmentsAll = roomAssignmentsAllData.success && Array.isArray(roomAssignmentsAllData.assignments)
        ? (roomAssignmentsAllData.assignments as { room_id: string; jornada: string; model_id: string }[]).map(a => ({
            room_id: a.room_id,
            jornada: a.jornada,
            model_id: a.model_id
          }))
        : [];
      setAllRoomAssignmentsFromApi(roomAssignmentsAll);

      // Calcular estadísticas reales
      const totalSedes = filteredGroups.length;
      const totalRooms = filteredRooms.length;
      
      // Filtrar modelos de manera segura
      let totalModelos = 0;
      console.log('🔍 [DASHBOARD] usersData:', usersData);
      if (usersData.success && usersData.users && Array.isArray(usersData.users)) {
        totalModelos = usersData.users.filter((u: any) => u.role === 'modelo' && u.is_active).length;
        console.log('✅ [DASHBOARD] Modelos encontrados:', totalModelos);
      } else {
        console.error('❌ [DASHBOARD] Error en usersData:', {
          success: usersData.success,
          hasUsers: !!usersData.users,
          isArray: Array.isArray(usersData.users),
          error: usersData.error
        });
      }
      
      const asignacionesActivas = filteredAssignments.length;
      
      // Calcular sedes con y sin rooms
      const sedesConRooms = filteredGroups.filter((group: any) => 
        filteredRooms.some((room: any) => room.group_id === group.id)
      ).length;
      
      const sedesSinRooms = totalSedes - sedesConRooms;

      setStats({
        totalSedes,
        totalRooms,
        totalModelos,
        asignacionesActivas,
        sedesConRooms,
        sedesSinRooms
      });

    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
      setError('Error cargando datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-48">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        
        {/* Mensaje de alerta para admins sin sedes asignadas */}
        {userRole === 'admin' && availableSedes.length === 0 && (
          <div className="mb-4 sm:mb-8">
            <div className="bg-gradient-to-r from-yellow-50/80 to-orange-50/80 dark:bg-yellow-900/20 dark:border-yellow-700/50 backdrop-blur-sm rounded-xl p-3 sm:p-6 border border-yellow-200/30 dark:border-yellow-700/50">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-lg font-semibold text-yellow-800 dark:text-yellow-200">Sin Sedes Asignadas</h3>
                  <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-300 mt-0.5 sm:mt-1">
                    No tienes sedes asignadas para ver estadísticas. Contacta al Super Admin para que te asigne sedes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <div className="bg-white/80 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/15 dark:ring-0.5 dark:ring-blue-400/20">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-3">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    Dashboard Sedes
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                    {userRole === 'super_admin' 
                      ? 'Vista global del estado de todas las sedes y asignaciones' 
                      : userRole === 'superadmin_aff'
                      ? 'Vista del estado de las sedes de tu estudio'
                      : 'Vista del estado de tus sedes asignadas'
                    }
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                Acceso: <span className="font-medium text-blue-600 dark:text-blue-400 dark:text-blue-400">
                  {userRole === 'super_admin' ? 'Super Admin' : userRole === 'superadmin_aff' ? 'Superadmin AFF' : 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de Facturación - SOLO para período actual */}
        {userId && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'superadmin_aff') && (
          <BillingSummary 
            userRole={userRole as 'admin' | 'super_admin' | 'superadmin_aff'} 
            userId={userId}
            userGroups={userGroups}
          />
        )}

        {/* Cierre Manual de Período — solo super_admin para evitar duplicados y conflictos */}
        {userId && userRole === 'super_admin' && (
          <ManualPeriodClosure 
            userId={userId}
            userRole="super_admin"
            groupId={userGroups[0]}
          />
        )}

        {/* Consulta de Períodos Históricos */}
        <div className="mb-4 sm:mb-8 relative z-40">
          <div className="bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl p-3 sm:p-6 border border-white/20 dark:border-gray-600/20 shadow-lg dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Consulta Histórica</h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 hidden sm:block">Consulta períodos históricos de facturación</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin_aff') && selectedMonth && selectedYear && selectedPeriod && (
                  <button
                    onClick={async () => {
                      // Calcular period_date y period_type
                      const year = parseInt(selectedYear);
                      const month = parseInt(selectedMonth);
                      const periodType = selectedPeriod === 'P1' ? '1-15' : '16-31';
                      
                      // Calcular period_date (fecha de INICIO del período)
                      // IMPORTANTE: Debe coincidir con cómo se guarda en calculator_history
                      // P1: día 1, P2: día 16
                      let day: number;
                      if (selectedPeriod === 'P1') {
                        day = 1; // Fecha de inicio del período P1 (1-15)
                      } else {
                        day = 16; // Fecha de inicio del período P2 (16-31)
                      }
                      const periodDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      
                      // Cargar información del período
                      await loadPeriodInfo(periodDate, periodType);
                      setShowEditRatesModal(true);
                    }}
                    disabled={!selectedMonth || !selectedYear || !selectedPeriod}
                    className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-md flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="hidden sm:inline">Editar RATES de cierre</span>
                    <span className="sm:hidden">RATES</span>
                  </button>
                )}
                <button
                  onClick={() => setShowHistoricalQuery(!showHistoricalQuery)}
                  className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
                >
                  <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showHistoricalQuery ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                  <span className="hidden sm:inline">{showHistoricalQuery ? 'Ocultar' : 'Consultar Períodos'}</span>
                  <span className="sm:hidden">{showHistoricalQuery ? 'Ocultar' : 'Consultar'}</span>
                </button>
              </div>
            </div>
            
            {showHistoricalQuery && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                {/* Año */}
                <div className="dropdown-container">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">Año</label>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'year' ? null : 'year')}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-0 bg-gray-50/80 dark:bg-gray-700/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-600 text-xs sm:text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 flex items-center justify-between active:scale-95 touch-manipulation"
                    >
                      <span>{selectedYear || 'Seleccionar año'}</span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                          dropdownOpen === 'year' ? 'rotate-180' : ''
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {dropdownOpen === 'year' && (
                      <div className="absolute z-[999999] mt-2 left-0 w-full bg-white dark:bg-gray-700 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-56 overflow-auto">
                        <div className="py-2">
                          {Array.from({ length: 5 }, (_, i) => {
                            const year = new Date().getFullYear() - i;
                            return (
                              <button
                                key={year}
                                onClick={() => {
                                  setSelectedYear(year.toString());
                                  setDropdownOpen(null);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors duration-200 flex items-center justify-between ${
                                  i < 4 ? 'border-b border-gray-100/50 dark:border-gray-600/50' : ''
                                } ${
                                  selectedYear === year.toString() 
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 font-medium' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                <span>{year}</span>
                                {selectedYear === year.toString() && (
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mes */}
                <div className="dropdown-container">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">Mes</label>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'month' ? null : 'month')}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-0 bg-gray-50/80 dark:bg-gray-700/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-600 text-xs sm:text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 flex items-center justify-between active:scale-95 touch-manipulation"
                    >
                      <span>{selectedMonth ? getMonthName(selectedMonth) : 'Seleccionar mes'}</span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                          dropdownOpen === 'month' ? 'rotate-180' : ''
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {dropdownOpen === 'month' && (
                      <div className="absolute z-[999999] mt-2 left-0 w-full bg-white dark:bg-gray-700 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-56 overflow-auto">
                        <div className="py-2">
                          {Array.from({ length: 12 }, (_, i) => {
                            const month = i + 1;
                            const monthName = getMonthName(month.toString());
                            return (
                              <button
                                key={month}
                                onClick={() => {
                                  setSelectedMonth(month.toString());
                                  setDropdownOpen(null);
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors duration-200 flex items-center justify-between ${
                                  i < 11 ? 'border-b border-gray-100/50 dark:border-gray-600/50' : ''
                                } ${
                                  selectedMonth === month.toString() 
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 font-medium' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                <span>{monthName}</span>
                                {selectedMonth === month.toString() && (
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Período */}
                <div className="dropdown-container col-span-2 md:col-span-1">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-1 sm:mb-2">Período</label>
                  <div className="relative">
                    <button
                      onClick={() => setDropdownOpen(dropdownOpen === 'period' ? null : 'period')}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-0 bg-gray-50/80 dark:bg-gray-700/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-600 text-xs sm:text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 flex items-center justify-between active:scale-95 touch-manipulation"
                    >
                      <span>{selectedPeriod}</span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                          dropdownOpen === 'period' ? 'rotate-180' : ''
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {dropdownOpen === 'period' && (
                      <div className="absolute z-[999999] mt-2 left-0 w-full bg-white dark:bg-gray-700 backdrop-blur-sm border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-56 overflow-auto">
                        <div className="py-2">
                          {['P1', 'P2'].map((period, index) => (
                            <button
                              key={period}
                              onClick={() => {
                                setSelectedPeriod(period);
                                setDropdownOpen(null);
                              }}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors duration-200 flex items-center justify-between ${
                                index < 1 ? 'border-b border-gray-100/50 dark:border-gray-600/50' : ''
                              } ${
                                selectedPeriod === period 
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-300 font-medium' 
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              <span>{period}</span>
                              {selectedPeriod === period && (
                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Resumen Histórico - Se muestra cuando hay un período seleccionado */}
            {showHistoricalQuery && selectedMonth && selectedYear && selectedPeriod && targetDate && (
              <div className="mt-3 sm:mt-6 -mx-3 sm:-mx-0 sm:mx-0">
                <BillingSummary 
                  userRole={userRole as 'admin' | 'super_admin' | 'superadmin_aff'} 
                  userId={userId}
                  userGroups={userGroups}
                  selectedDate={targetDate}
                  selectedPeriod={selectedPeriod === 'P1' ? 'period-1' : 'period-2'}
                />
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 dark:border-red-700/50 border border-red-200 dark:border-red-700/50 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Corcho Informativo - Gestión de Publicaciones */}
        {userId && (userRole === 'super_admin' || userRole === 'admin' || userRole === 'superadmin_aff') && (
          <div className="mb-8">
            <AnnouncementManager 
              userId={userId}
              userRole={userRole as 'super_admin' | 'admin' | 'superadmin_aff'}
              userGroups={userGroups}
            />
          </div>
        )}

        {/* Modal para Editar RATES de cierre */}
        {showEditRatesModal && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                if (!savingRates) {
                  setShowEditRatesModal(false);
                  setRatesError(null);
                }
              }}
            />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">Editar RATES de cierre</h2>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                      {selectedMonth && selectedYear && selectedPeriod ? 
                        `${getMonthName(selectedMonth)} ${selectedYear} - ${selectedPeriod} (${selectedPeriod === 'P1' ? 'Días 1-15' : 'Días 16-31'})` : 
                        'Selecciona un período'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!savingRates) {
                      setShowEditRatesModal(false);
                      setRatesError(null);
                    }
                  }}
                  disabled={savingRates}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed p-1 active:scale-95 touch-manipulation flex-shrink-0"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Resumen de registros afectados */}
                {loadingPeriodInfo ? (
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : periodInfo ? (
                  <>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-300">Resumen del período</h3>
                      </div>
                      <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400 leading-relaxed">
                        Esta acción <strong className="font-semibold">reemplazará</strong> las tasas históricas guardadas y <strong className="font-semibold">recalculará</strong> todos los valores derivados en <strong className="font-semibold">{periodInfo.records_count}</strong> registros históricos del período seleccionado.
                      </p>
                      <p className="text-[10px] sm:text-xs text-blue-700 dark:text-blue-500 mt-1.5 sm:mt-2 leading-relaxed">
                        ⚠️ <strong>Importante:</strong> Las tasas guardadas en "Mi Historial" de todas las modelos para este período serán reemplazadas por las nuevas tasas. Todos los valores (USD bruto, USD modelo, COP modelo) serán recalculados automáticamente.
                      </p>
                      <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-500 mt-1.5 sm:mt-2 leading-relaxed">
                        ✅ Solo afecta períodos <strong>cerrados</strong> (archivados). No afecta las RATES actuales ni los cálculos del período en curso.
                      </p>
                    </div>

                    {/* Tasas actuales (si existen) */}
                    {periodInfo.current_rates && (
                      (periodInfo.current_rates.eur_usd !== null || periodInfo.current_rates.gbp_usd !== null || periodInfo.current_rates.usd_cop !== null) && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 sm:p-4">
                          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Tasas actuales del período:</h4>
                          <div className="grid grid-cols-3 gap-2 sm:gap-4">
                            <div>
                              <label className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">EUR → USD</label>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {periodInfo.current_rates.eur_usd !== null ? periodInfo.current_rates.eur_usd.toFixed(4) : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">GBP → USD</label>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {periodInfo.current_rates.gbp_usd !== null ? periodInfo.current_rates.gbp_usd.toFixed(4) : 'N/A'}
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">USD → COP</label>
                              <div className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {periodInfo.current_rates.usd_cop !== null ? periodInfo.current_rates.usd_cop.toFixed(2) : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    )}

                    {/* Formulario de edición */}
                    <div className="space-y-3 sm:space-y-4">
                      <h4 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Nuevas tasas:</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                        {/* EUR → USD */}
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                            EUR → USD
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={editRates.eur_usd}
                            onChange={(e) => setEditRates({ ...editRates, eur_usd: e.target.value })}
                            className="w-full px-2.5 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="1.0100"
                            disabled={savingRates}
                          />
                        </div>

                        {/* GBP → USD */}
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                            GBP → USD
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={editRates.gbp_usd}
                            onChange={(e) => setEditRates({ ...editRates, gbp_usd: e.target.value })}
                            className="w-full px-2.5 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="1.2000"
                            disabled={savingRates}
                          />
                        </div>

                        {/* USD → COP */}
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                            USD → COP
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={editRates.usd_cop}
                            onChange={(e) => setEditRates({ ...editRates, usd_cop: e.target.value })}
                            className="w-full px-2.5 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="3900.00"
                            disabled={savingRates}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Error message */}
                    {ratesError && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-red-800 dark:text-red-400">{ratesError}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No se pudo cargar la información del período
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
                <button
                  onClick={() => {
                    if (!savingRates) {
                      setShowEditRatesModal(false);
                      setRatesError(null);
                    }
                  }}
                  disabled={savingRates}
                  className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-95 touch-manipulation"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    // Confirmación antes de guardar
                    const scopeText = userRole === 'super_admin' 
                      ? 'todas las modelos globalmente' 
                      : userRole === 'superadmin_aff'
                      ? 'las modelos de tu estudio'
                      : 'las modelos de tus grupos';
                    const confirmMessage = `¿Estás seguro de actualizar las tasas históricas para ${periodInfo?.records_count || 0} registros del período ${selectedMonth && selectedYear && selectedPeriod ? `${getMonthName(selectedMonth)} ${selectedYear} - ${selectedPeriod}` : ''}?\n\n⚠️ Esta acción:\n- Reemplazará las tasas guardadas en "Mi Historial" de ${scopeText}\n- Recalculará todos los valores derivados (USD bruto, USD modelo, COP modelo)\n- Solo afecta períodos CERRADOS (archivados), NO afecta el período en curso\n\n¿Continuar?`;
                    
                    if (window.confirm(confirmMessage)) {
                      await savePeriodRates();
                    }
                  }}
                  disabled={savingRates || !periodInfo || !editRates.eur_usd || !editRates.gbp_usd || !editRates.usd_cop}
                  className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg hover:from-purple-600 hover:to-purple-700 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
                >
                  {savingRates ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Guardar Tasas</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Selector de Disponibilidad con Dropdown Personalizado */}
        <div className="mb-4 sm:mb-6 relative z-40 overflow-visible">
          <div className="bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 p-3 sm:p-6 pb-4 sm:pb-8 overflow-visible dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:space-x-4">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">Consultar Disponibilidad:</span>
              </div>
              <div className="flex-1 sm:max-w-xs relative">
                <div className="relative dropdown-container">
                  <button
                    onClick={() => setDropdownOpen(dropdownOpen === 'sede' ? null : 'sede')}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border-0 bg-gray-50/80 dark:bg-gray-700/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-600 text-xs sm:text-sm text-gray-700 dark:text-gray-200 transition-all duration-200 cursor-pointer text-left flex items-center justify-between active:scale-95 touch-manipulation"
                  >
                    <span className={selectedSede ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
                      {selectedSede ? availableSedes.find(s => s.id === selectedSede)?.name || 'Selecciona una sede...' : 'Selecciona una sede...'}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${dropdownOpen === 'sede' ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {dropdownOpen === 'sede' && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 dark:border-gray-700/20 z-[99999] max-h-60 overflow-y-auto">
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setSelectedSede('');
                            setDropdownOpen(null);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50/80 dark:hover:bg-blue-900/20 transition-colors duration-200 flex items-center border-b border-gray-100/50 dark:border-gray-700/50"
                        >
                          <span className="text-gray-500 dark:text-gray-400">Selecciona una sede...</span>
                        </button>
                        {availableSedes.map((sede, index) => (
                          <button
                            key={sede.id}
                            onClick={() => {
                              setSelectedSede(sede.id);
                              setDropdownOpen(null);
                              setShowTodasSedes(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-sm transition-colors duration-200 flex items-center ${
                              index < availableSedes.length - 1 ? 'border-b border-gray-100/50 dark:border-gray-700/50' : ''
                            } ${
                              selectedSede === sede.id 
                                ? 'bg-blue-50/80 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-medium' 
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50/80 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <span>{sede.name}</span>
                            {selectedSede === sede.id && (
                              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 dark:text-blue-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {selectedSede && (
                <button
                  onClick={() => setSelectedSede('')}
                  className="p-1.5 sm:p-2 hover:bg-gray-100/80 rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation flex-shrink-0"
                  title="Cerrar consulta"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(null);
                  setSelectedSede('');
                  setShowTodasSedes(true);
                  loadTodasSedesDisponibilidad();
                }}
                disabled={!availableSedes.length || loadingTodasSedes}
                className="px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-700/50 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:ring-2 focus:ring-blue-500/20 transition-all active:scale-95 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
              >
                {loadingTodasSedes ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent" />
                    <span>Cargando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 012-2h-2a2 2 0 00-2-2H6z" />
                    </svg>
                    <span>Ver todas las sedes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de disponibilidad de todas las sedes */}
        {showTodasSedes && (
          <div className="mb-6 sm:mb-10 relative z-0">
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200/50 dark:border-gray-600/50">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Disponibilidad por sede y room</h2>
                  <button
                    onClick={() => setShowTodasSedes(false)}
                    className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                    title="Cerrar"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6">
                {loadingTodasSedes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">Cargando todas las sedes...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-500/50">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-gray-100/80 dark:bg-gray-600/80 border-b border-gray-200 dark:border-gray-500">
                          <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200">Sede</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200">Room</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 text-center">Mañana</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 text-center">Tarde</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 text-center">Noche</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/50 dark:divide-gray-500/50">
                        {disponibilidadTodasSedes.map((row) => (
                          <tr key={`${row.sede_id}-${row.room_id}`} className="bg-white/50 dark:bg-gray-700/30 hover:bg-gray-50/80 dark:hover:bg-gray-600/30">
                            <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-900 dark:text-gray-100 font-medium">{row.sede_nombre}</td>
                            <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-800 dark:text-gray-200">{row.room_name}</td>
                            <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                              {row.manana ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">Disponible</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">Ocupado</span>
                              )}
                            </td>
                            <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                              {row.tarde ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">Disponible</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">Ocupado</span>
                              )}
                            </td>
                            <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                              {row.noche ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">Disponible</span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">Ocupado</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {disponibilidadTodasSedes.length === 0 && !loadingTodasSedes && (
                      <p className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">No hay rooms en las sedes disponibles.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resumen de Disponibilidad - Solo se muestra cuando hay una sede seleccionada */}
        {selectedSede && (
          <div className="mb-6 sm:mb-10 relative z-0">
            <div className="relative bg-white/70 dark:bg-gray-700/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 dark:border-gray-600/20 dark:shadow-lg dark:shadow-blue-900/10 dark:ring-0.5 dark:ring-blue-500/15">
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200/50 dark:border-gray-600/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center flex-shrink-0">
                      <svg className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">Resumen de Disponibilidad</h2>
                  </div>
                  <button
                    onClick={() => setSelectedSede('')}
                    className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 active:scale-95 touch-manipulation"
                    title="Cerrar consulta"
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6">
                {/* Resumen de disponibilidad */}
                <div className="space-y-4">
                    {loadingDisponibilidad ? (
                    <div className="flex items-center justify-center py-6 sm:py-8">
                      <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-gray-600">Cargando disponibilidad...</span>
                    </div>
                  ) : sedeDisponibilidad ? (
                    <div className="space-y-4">
                      {/* Header de la sede */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 sm:p-4 border border-blue-200/50 dark:border-blue-700/50">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          {sedeDisponibilidad.sede_nombre}
                        </h3>
                        <div className="grid grid-cols-3 gap-2 sm:gap-4">
                          <div className="text-center">
                            <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400 dark:text-blue-400">
                              {sedeDisponibilidad.rooms_disponibles}/{sedeDisponibilidad.rooms_totales}
                            </p>
                            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">Rooms Disponibles</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                              {sedeDisponibilidad.total_espacios}
                            </p>
                            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">Total Espacios</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {Object.values(sedeDisponibilidad.jornadas_dobladas).reduce((a, b) => a + b, 0)}
                            </p>
                            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">Doblajes Activos</p>
                          </div>
                        </div>
                      </div>

                      {/* Tabla: sedes (columna) y rooms con jornada disponible (filas) */}
                      <div className="overflow-x-auto rounded-lg border border-gray-200/50 dark:border-gray-500/50">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="bg-gray-100/80 dark:bg-gray-600/80 border-b border-gray-200 dark:border-gray-500">
                              <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200">Sede</th>
                              <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200">Room</th>
                              <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 text-center">Mañana</th>
                              <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 text-center">Tarde</th>
                              <th className="px-3 py-2 sm:px-4 sm:py-3 font-semibold text-gray-700 dark:text-gray-200 text-center">Noche</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200/50 dark:divide-gray-500/50">
                            {disponibilidadPorRoom.map((row) => (
                              <tr key={row.room_id} className="bg-white/50 dark:bg-gray-700/30 hover:bg-gray-50/80 dark:hover:bg-gray-600/30">
                                <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-900 dark:text-gray-100 font-medium">
                                  {sedeDisponibilidad.sede_nombre}
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-800 dark:text-gray-200">{row.room_name}</td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                                  {row.manana ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">Disponible</span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">Ocupado</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                                  {row.tarde ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">Disponible</span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">Ocupado</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                                  {row.noche ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">Disponible</span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">Ocupado</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {disponibilidadPorRoom.length === 0 && (
                          <p className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">No hay rooms en esta sede.</p>
                        )}
                      </div>

                      {/* Desglose por jornadas */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-4">
                        {[
                          { key: 'manana', label: 'Mañana', color: 'from-orange-500 to-amber-600' },
                          { key: 'tarde', label: 'Tarde', color: 'from-blue-500 to-indigo-600' },
                          { key: 'noche', label: 'Noche', color: 'from-purple-500 to-violet-600' }
                        ].map((jornada) => (
                          <div key={jornada.key} className="bg-white/80 dark:bg-gray-600/80 backdrop-blur-sm rounded-lg p-2.5 sm:p-4 border border-gray-200/50 dark:border-gray-500/50">
                            <div className="flex items-center space-x-1.5 sm:space-x-2 mb-2 sm:mb-3">
                              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gradient-to-r ${jornada.color} rounded-full flex-shrink-0`}></div>
                              <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">{jornada.label}</h4>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">Disponibles:</span>
                                <span className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400">
                                  {sedeDisponibilidad.jornadas_disponibles[jornada.key as keyof typeof sedeDisponibilidad.jornadas_disponibles]}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400">Dobladas:</span>
                                <span className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 dark:text-blue-400">
                                  {sedeDisponibilidad.jornadas_dobladas[jornada.key as keyof typeof sedeDisponibilidad.jornadas_dobladas]}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Información adicional */}
                      <div className="bg-gray-50/80 dark:bg-gray-600/80 rounded-lg p-2.5 sm:p-4 border border-gray-200/50 dark:border-gray-500/50">
                        <div className="flex items-start space-x-1.5 sm:space-x-2">
                          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                            <svg className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                          </div>
                          <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium mb-0.5 sm:mb-1">Información para nuevas modelos:</p>
                            <p className="leading-relaxed">• <strong>Disponibles:</strong> Espacios libres para asignar nuevas modelos</p>
                            <p className="leading-relaxed">• <strong>Dobladas:</strong> Modelos que trabajan en múltiples jornadas</p>
                            <p className="leading-relaxed">• <strong>Total Espacios:</strong> Capacidad máxima (rooms × 3 jornadas)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>No se pudo cargar la disponibilidad de esta sede</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
