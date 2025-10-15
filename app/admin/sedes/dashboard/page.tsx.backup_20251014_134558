'use client';

import { useState, useEffect } from 'react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  
  // Estados para resumen de disponibilidad
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [sedeDisponibilidad, setSedeDisponibilidad] = useState<SedeDisponibilidad | null>(null);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const [availableSedes, setAvailableSedes] = useState<Group[]>([]);

  useEffect(() => {
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();
    loadDashboardData();
  }, []);

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
      const totalModelos = usersData.success ? usersData.users?.filter((u: any) => u.role === 'modelo' && u.is_active).length || 0 : 0;
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        {/* Header */}
        <div className="mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-xl blur-xl"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Dashboard Sedes
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                      {userRole === 'super_admin' 
                        ? 'Vista global del estado de todas las sedes y asignaciones' 
                        : 'Vista del estado de tus sedes asignadas'
                      }
                    </p>
                  </div>
                </div>
                {userRole === 'super_admin' && (
                  <div className="flex items-center space-x-1.5 bg-purple-100 px-2 py-1 rounded-full">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    <span className="text-xs font-medium text-purple-700">Super Admin</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Total Sedes</p>
                <p className="text-lg font-semibold text-gray-900">{stats.totalSedes}</p>
              </div>
            </div>
          </div>

          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Total Rooms</p>
                <p className="text-lg font-semibold text-gray-900">{stats.totalRooms}</p>
              </div>
            </div>
          </div>

          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-violet-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Modelos Asignados</p>
                <p className="text-lg font-semibold text-gray-900">{stats.asignacionesActivas}</p>
              </div>
            </div>
          </div>

          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-amber-600 rounded-md flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-gray-500">Sedes con Rooms</p>
                <p className="text-lg font-semibold text-gray-900">{stats.sedesConRooms}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Selector Compacto de Disponibilidad */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-sm flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Consultar Disponibilidad:</span>
            </div>
            <select
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm text-sm"
            >
              <option value="">Selecciona una sede...</option>
              {availableSedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.name}
                </option>
              ))}
            </select>
            {selectedSede && (
              <button
                onClick={() => setSelectedSede('')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                title="Cerrar consulta"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
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

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sedes Status */}
          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20">
            <div className="px-6 py-4 border-b border-gray-200/50">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Estado de Sedes</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Sedes con rooms configurados</span>
                  <span className="text-sm font-medium text-green-600">{stats.sedesConRooms}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Sedes sin rooms configurados</span>
                  <span className="text-sm font-medium text-orange-600">{stats.sedesSinRooms}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all" 
                    style={{ width: `${(stats.sedesConRooms / stats.totalSedes) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20">
            <div className="px-6 py-4 border-b border-gray-200/50">
              <div className="flex items-center space-x-2">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Acciones Rápidas</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {/* Acciones para Super Admin */}
                {userRole === 'super_admin' && (
                  <>
                    <button 
                      onClick={() => window.location.href = '/admin/sedes/gestionar'}
                      className="w-full text-left px-3 py-2 bg-blue-50/80 hover:bg-blue-100/80 rounded-lg transition-all duration-300 border border-blue-200/50"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-sm flex items-center justify-center mr-2">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-blue-900">Crear Nueva Sede</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => window.location.href = '/admin/sedes/gestionar'}
                      className="w-full text-left px-3 py-2 bg-green-50/80 hover:bg-green-100/80 rounded-lg transition-all duration-300 border border-green-200/50"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-sm flex items-center justify-center mr-2">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-green-900">Gestionar Todas las Sedes</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => window.location.href = '/admin/sedes/asignaciones'}
                      className="w-full text-left px-3 py-2 bg-purple-50/80 hover:bg-purple-100/80 rounded-lg transition-all duration-300 border border-purple-200/50"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-sm flex items-center justify-center mr-2">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-purple-900">Ver Todas las Asignaciones</span>
                      </div>
                    </button>
                  </>
                )}

                {/* Acciones para Admin */}
                {userRole === 'admin' && (
                  <>
                    <button 
                      onClick={() => window.location.href = '/admin/sedes/gestionar'}
                      className="w-full text-left px-3 py-2 bg-green-50/80 hover:bg-green-100/80 rounded-lg transition-all duration-300 border border-green-200/50"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-sm flex items-center justify-center mr-2">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-green-900">Gestionar Mis Sedes</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => window.location.href = '/admin/sedes/asignaciones'}
                      className="w-full text-left px-3 py-2 bg-purple-50/80 hover:bg-purple-100/80 rounded-lg transition-all duration-300 border border-purple-200/50"
                    >
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-sm flex items-center justify-center mr-2">
                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-purple-900">Ver Mis Asignaciones</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Development Notice */}
        <div className="mt-8 relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-xs text-gray-700">
                🚧 Este dashboard está en desarrollo. Los datos mostrados son de ejemplo y se actualizarán 
                con información real del sistema una vez que se complete la implementación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
