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

  useEffect(() => {
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();
    loadDashboardData();
  }, []);

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
