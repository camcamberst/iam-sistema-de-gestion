'use client';

import { useState, useEffect } from 'react';
import BillingSummary from '../../../../components/BillingSummary';

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
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const [availableSedes, setAvailableSedes] = useState<Group[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedYear && selectedPeriod) {
      calculateTargetDate();
    }
  }, [selectedMonth, selectedYear, selectedPeriod]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (dropdownOpen && !target.closest('.dropdown-container')) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Scroll automático cuando se abre el dropdown
  useEffect(() => {
    if (dropdownOpen) {
      // Pequeño delay para asegurar que el dropdown se renderice
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

  // Cargar datos del dashboard después de cargar la información del usuario
  useEffect(() => {
    if (userRole && userGroups.length >= 0) {
      loadDashboardData();
    }
  }, [userRole, userGroups]);

  // Cargar disponibilidad cuando se seleccione una sede
  useEffect(() => {
    if (selectedSede && availableSedes.length > 0) {
      loadSedeDisponibilidad(selectedSede);
    }
  }, [selectedSede, availableSedes]);

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

  const loadSedeDisponibilidad = async (sedeId: string) => {
    if (!sedeId) {
      setSedeDisponibilidad(null);
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

      // Obtener asignaciones de todos los rooms de la sede
      const assignmentsPromises = sedeRooms.map(async (room: Room) => {
        try {
          const response = await fetch(`/api/room-assignments?roomId=${room.id}`);
          const data = await response.json();
          return data.success ? data.assignments : [];
        } catch (error) {
          console.warn(`Error obteniendo asignaciones para room ${room.id}:`, error);
          return [];
        }
      });

      const allAssignments = await Promise.all(assignmentsPromises);
      const flatAssignments = allAssignments.flat();

      // Calcular disponibilidad por jornada
      const jornadas = ['MAÑANA', 'TARDE', 'NOCHE'];
      const jornadasDisponibles = { manana: 0, tarde: 0, noche: 0 };
      const jornadasDobladas = { manana: 0, tarde: 0, noche: 0 };

      jornadas.forEach((jornada, index) => {
        const jornadaKey = index === 0 ? 'manana' : index === 1 ? 'tarde' : 'noche';
        
        // Contar asignaciones por jornada
        const asignacionesJornada = flatAssignments.filter((assignment: any) => 
          assignment.jornada === jornada
        );

        // Contar modelos únicas (para detectar doblaje)
        const modelosUnicas = new Set(asignacionesJornada.map((a: any) => a.model_id));
        
        // Espacios disponibles = total rooms - asignaciones únicas
        const espaciosDisponibles = Math.max(0, sedeRooms.length - modelosUnicas.size);
        jornadasDisponibles[jornadaKey] = espaciosDisponibles;

        // Contar doblajes (asignaciones adicionales de modelos que ya están en otra jornada)
        const doblajes = Math.max(0, asignacionesJornada.length - modelosUnicas.size);
        jornadasDobladas[jornadaKey] = doblajes;
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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos reales desde la API con filtrado por rol
      const [groupsResponse, roomsResponse, usersResponse, assignmentsResponse] = await Promise.all([
        fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userRole, userGroups })
        }),
        fetch('/api/groups/rooms'),
        fetch('/api/users'),
        fetch('/api/assignments/all')
      ]);

      const [groupsData, roomsData, usersData, assignmentsData] = await Promise.all([
        groupsResponse.json(),
        roomsResponse.json(),
        usersResponse.json(),
        assignmentsResponse.json()
      ]);

      // Filtrar datos según el rol del usuario
      let filteredGroups = groupsData.success ? groupsData.groups || [] : [];
      let filteredRooms = roomsData.success ? roomsData.rooms || [] : [];
      let filteredAssignments = assignmentsData.success ? assignmentsData.assignments || [] : [];

      // Si es admin (no super_admin), filtrar por sus grupos
      if (userRole !== 'super_admin' && userGroups.length > 0) {
        filteredRooms = filteredRooms.filter((room: any) => userGroups.includes(room.group_id));
        filteredAssignments = filteredAssignments.filter((assignment: any) => userGroups.includes(assignment.group_id));
      }

      // Filtrar sedes operativas (excluir Otros y Satélites) para el dropdown
      const sedesOperativas = filteredGroups.filter((group: any) => 
        group.name !== 'Otros' && 
        group.name !== 'Satélites'
      );
      setAvailableSedes(sedesOperativas);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        
        {/* Mensaje de alerta para admins sin sedes asignadas */}
        {userRole === 'admin' && availableSedes.length === 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-yellow-50/80 to-orange-50/80 backdrop-blur-sm rounded-xl p-6 border border-yellow-200/30">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-yellow-800">Sin Sedes Asignadas</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    No tienes sedes asignadas para ver estadísticas. Contacta al Super Admin para que te asigne sedes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    Dashboard Sedes
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {userRole === 'super_admin' 
                      ? 'Vista global del estado de todas las sedes y asignaciones' 
                      : 'Vista del estado de tus sedes asignadas'
                    }
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Acceso: <span className="font-medium text-blue-600">
                  {userRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Consulta de Períodos Históricos */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Consulta Histórica</h2>
                  <p className="text-sm text-gray-600">Consulta períodos históricos de facturación</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoricalQuery(!showHistoricalQuery)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 shadow-md"
              >
                {showHistoricalQuery ? 'Ocultar' : 'Consultar Períodos'}
              </button>
            </div>
            
            {showHistoricalQuery && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Año */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Año</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                  >
                    <option value="">Seleccionar año</option>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <option key={year} value={year.toString()}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Mes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mes</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                  >
                    <option value="">Seleccionar mes</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const monthName = getMonthName(month.toString());
                      return (
                        <option key={month} value={month.toString()}>
                          {monthName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Período */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200"
                  >
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                  </select>
                </div>

                {/* Información del período seleccionado */}
                <div className="flex items-end">
                  {selectedMonth && selectedYear && selectedPeriod && (
                    <div className="w-full p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-sm font-medium text-blue-800">
                        {getMonthName(selectedMonth)} {selectedYear} - {selectedPeriod}
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {selectedPeriod === 'P1' ? 'Días 1-15' : 'Días 16-31'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumen de Facturación */}
        {userId && (userRole === 'super_admin' || userRole === 'admin') && (
          <BillingSummary 
            userRole={userRole as 'admin' | 'super_admin'} 
            userId={userId}
            userGroups={userGroups}
            selectedDate={targetDate}
            selectedPeriod={selectedPeriod}
          />
        )}

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}


        {/* Selector de Disponibilidad con Dropdown Personalizado */}
        <div className="mb-96 min-h-[400px]">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 pb-8">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Consultar Disponibilidad:</span>
              </div>
              <div className="flex-1 max-w-xs relative">
                <div className="relative dropdown-container">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full px-4 py-3 border-0 bg-gray-50/80 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-sm text-gray-700 transition-all duration-200 cursor-pointer text-left flex items-center justify-between"
                  >
                    <span className={selectedSede ? 'text-gray-900' : 'text-gray-500'}>
                      {selectedSede ? availableSedes.find(s => s.id === selectedSede)?.name || 'Selecciona una sede...' : 'Selecciona una sede...'}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 z-[9999] overflow-hidden">
                      <div className="py-2">
                        <button
                          onClick={() => {
                            setSelectedSede('');
                            setDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50/80 transition-colors duration-200 flex items-center border-b border-gray-100/50"
                        >
                          <span className="text-gray-500">Selecciona una sede...</span>
                        </button>
                        {availableSedes.map((sede, index) => (
                          <button
                            key={sede.id}
                            onClick={() => {
                              setSelectedSede(sede.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-sm transition-colors duration-200 flex items-center ${
                              index < availableSedes.length - 1 ? 'border-b border-gray-100/50' : ''
                            } ${
                              selectedSede === sede.id 
                                ? 'bg-blue-50/80 text-blue-900 font-medium' 
                                : 'text-gray-700 hover:bg-gray-50/80'
                            }`}
                          >
                            <span>{sede.name}</span>
                            {selectedSede === sede.id && (
                              <svg className="w-4 h-4 text-blue-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="p-2 hover:bg-gray-100/80 rounded-lg transition-colors duration-200"
                  title="Cerrar consulta"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resumen de Disponibilidad - Solo se muestra cuando hay una sede seleccionada */}
        {selectedSede && (
          <div className="mb-10">
            <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20">
              <div className="px-6 py-4 border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">Resumen de Disponibilidad</h2>
                  </div>
                  <button
                    onClick={() => setSelectedSede('')}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    title="Cerrar consulta"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                {/* Resumen de disponibilidad */}
                <div className="space-y-4">
                  {loadingDisponibilidad ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-3 text-gray-600">Cargando disponibilidad...</span>
                    </div>
                  ) : sedeDisponibilidad ? (
                    <div className="space-y-4">
                      {/* Header de la sede */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200/50">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {sedeDisponibilidad.sede_nombre}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-blue-600">
                              {sedeDisponibilidad.rooms_disponibles}/{sedeDisponibilidad.rooms_totales}
                            </p>
                            <p className="text-sm text-gray-600">Rooms Disponibles</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                              {sedeDisponibilidad.total_espacios}
                            </p>
                            <p className="text-sm text-gray-600">Total Espacios</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-purple-600">
                              {Object.values(sedeDisponibilidad.jornadas_dobladas).reduce((a, b) => a + b, 0)}
                            </p>
                            <p className="text-sm text-gray-600">Doblajes Activos</p>
                          </div>
                        </div>
                      </div>

                      {/* Desglose por jornadas */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { key: 'manana', label: 'Mañana', color: 'from-orange-500 to-amber-600' },
                          { key: 'tarde', label: 'Tarde', color: 'from-blue-500 to-indigo-600' },
                          { key: 'noche', label: 'Noche', color: 'from-purple-500 to-violet-600' }
                        ].map((jornada) => (
                          <div key={jornada.key} className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200/50">
                            <div className="flex items-center space-x-2 mb-3">
                              <div className={`w-3 h-3 bg-gradient-to-r ${jornada.color} rounded-full`}></div>
                              <h4 className="font-medium text-gray-900">{jornada.label}</h4>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Disponibles:</span>
                                <span className="font-semibold text-green-600">
                                  {sedeDisponibilidad.jornadas_disponibles[jornada.key as keyof typeof sedeDisponibilidad.jornadas_disponibles]}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Dobladas:</span>
                                <span className="font-semibold text-blue-600">
                                  {sedeDisponibilidad.jornadas_dobladas[jornada.key as keyof typeof sedeDisponibilidad.jornadas_dobladas]}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Información adicional */}
                      <div className="bg-gray-50/80 rounded-lg p-4 border border-gray-200/50">
                        <div className="flex items-start space-x-2">
                          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                          </div>
                          <div className="text-sm text-gray-700">
                            <p className="font-medium mb-1">Información para nuevas modelos:</p>
                            <p>• <strong>Disponibles:</strong> Espacios libres para asignar nuevas modelos</p>
                            <p>• <strong>Dobladas:</strong> Modelos que trabajan en múltiples jornadas</p>
                            <p>• <strong>Total Espacios:</strong> Capacidad máxima (rooms × 3 jornadas)</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
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
