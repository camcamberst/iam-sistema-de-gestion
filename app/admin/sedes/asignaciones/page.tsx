'use client';

import { useState, useEffect } from 'react';

interface Assignment {
  id: string;
  model_id: string;
  modelo_name: string;
  modelo_email: string;
  group_id: string;
  grupo_name: string;
  room_id: string;
  room_name: string;
  jornada: string;
  assigned_at: string;
  is_active: boolean;
}

export default function AsignacionesPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterJornada, setFilterJornada] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('admin');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  useEffect(() => {
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();
    loadAssignments();
  }, []);

  const loadUserInfo = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUserRole(parsed.role || 'admin');
        setUserGroups(parsed.groups?.map((g: any) => g.id) || []);
        setAvailableGroups(parsed.groups?.map((g: any) => g.name) || []);
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
    }
  };

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/assignments/all');
      const data = await response.json();
      
      if (data.success) {
        setAssignments(data.assignments || []);
      } else {
        setError(data.error || 'Error cargando asignaciones');
      }

    } catch (err) {
      console.error('Error cargando asignaciones:', err);
      setError('Error de conexión al cargar asignaciones');
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    // Filtrar por rol del usuario
    if (userRole !== 'super_admin' && userGroups.length > 0) {
      if (!userGroups.includes(assignment.group_id)) return false;
    }
    
    // Filtrar por grupo seleccionado
    if (filterGroup && assignment.grupo_name !== filterGroup) return false;
    
    // Filtrar por jornada
    if (filterJornada && assignment.jornada !== filterJornada) return false;
    
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando asignaciones...</p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Asignaciones
                    </h1>
                    <p className="mt-1 text-sm text-gray-600">
                      {userRole === 'super_admin' 
                        ? 'Vista global de todas las asignaciones de modelos' 
                        : 'Vista de asignaciones de tus sedes asignadas'
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

        {/* Filters */}
        <div className="mb-10 relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Sede
              </label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm"
              >
                <option value="">
                  {userRole === 'super_admin' ? 'Todas las sedes' : 'Todas mis sedes'}
                </option>
                {userRole === 'super_admin' ? (
                  <>
                    <option value="Sede MP">Sede MP</option>
                    <option value="Cabecera">Cabecera</option>
                    <option value="Victoria">Victoria</option>
                    <option value="Terrazas">Terrazas</option>
                    <option value="Diamante">Diamante</option>
                    <option value="Satélites">Satélites</option>
                    <option value="Otros">Otros</option>
                  </>
                ) : (
                  availableGroups.map(groupName => (
                    <option key={groupName} value={groupName}>{groupName}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Jornada
              </label>
              <select
                value={filterJornada}
                onChange={(e) => setFilterJornada(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/80 backdrop-blur-sm"
              >
                <option value="">Todas las jornadas</option>
                <option value="MAÑANA">Mañana</option>
                <option value="TARDE">Tarde</option>
                <option value="NOCHE">Noche</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20">
          <div className="px-6 py-4 border-b border-gray-200/50">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900">
                Asignaciones Actuales ({filteredAssignments.length})
              </h2>
            </div>
          </div>
          <div className="p-6">
            {filteredAssignments.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-sm font-medium">🚧 Esta página está en desarrollo</p>
                <p className="mt-1 text-xs">Próximamente podrás ver todas las asignaciones de modelos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200/50">
                  <thead className="bg-gray-50/50 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Modelo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sede
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jornada
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Asignado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50 divide-y divide-gray-200/50">
                    {filteredAssignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-white/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-xs font-medium text-gray-900">
                              {assignment.modelo_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {assignment.modelo_email}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-900">
                          {assignment.grupo_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-900">
                          {assignment.room_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-900">
                          {assignment.jornada}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {new Date(assignment.assigned_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            assignment.is_active 
                              ? 'bg-green-100/80 text-green-800 border border-green-200/50' 
                              : 'bg-gray-100/80 text-gray-800 border border-gray-200/50'
                          }`}>
                            {assignment.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
