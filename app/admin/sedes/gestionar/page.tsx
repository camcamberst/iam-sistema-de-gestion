"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppleDropdown from '@/components/ui/AppleDropdown';

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
}

export default function GestionarSedesPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para admin
  const [userRole, setUserRole] = useState<string>('admin');
  const [selectedSedeForAdmin, setSelectedSedeForAdmin] = useState<string>('');
  const [selectedSedeForSuperAdmin, setSelectedSedeForSuperAdmin] = useState<string>('');
  const [sedesConRoomsJornadas, setSedesConRoomsJornadas] = useState<any[]>([]);
  
  // Estados para configuración de rooms
  const [showRoomConfig, setShowRoomConfig] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomAssignments, setRoomAssignments] = useState<any[]>([]);
  const [roomConfigError, setRoomConfigError] = useState('');
  const [roomConfigSuccess, setRoomConfigSuccess] = useState('');
  
  // NUEVOS ESTADOS para funcionalidad de asignación
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedJornada, setSelectedJornada] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [conflictInfo, setConflictInfo] = useState<any>(null);
  
  const router = useRouter();

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
    if (userRole === 'super_admin') {
      loadSedesConRoomsJornadas();
    }
  }, [userRole]);

  const loadSedesConRoomsJornadas = async () => {
    try {
      // Obtener todas las sedes
      const groupsResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRole: 'super_admin', userGroups: [] })
      });
      const groupsData = await groupsResponse.json();
      
      if (!groupsData.success) return;
      
      // Obtener todas las rooms
      const roomsResponse = await fetch('/api/groups/rooms');
      const roomsData = await roomsResponse.json();
      
      if (!roomsData.success) return;
      
      // Filtrar sedes que tienen rooms
      const sedesConRooms = groupsData.groups.filter((group: any) => 
        roomsData.rooms?.some((room: any) => room.group_id === group.id)
      );
      
      // Verificar que tengan jornadas configuradas (rooms con asignaciones)
      const sedesConJornadas = await Promise.all(
        sedesConRooms.map(async (sede: any) => {
          // Obtener rooms de esta sede
          const sedeRooms = roomsData.rooms.filter((room: any) => room.group_id === sede.id);
          
          // Verificar si alguna room tiene asignaciones
          for (const room of sedeRooms) {
            try {
              const assignmentsResponse = await fetch(`/api/rooms/${room.id}/assignments`);
              const assignmentsData = await assignmentsResponse.json();
              
              if (assignmentsData.success && assignmentsData.assignments?.length > 0) {
                return sede;
              }
            } catch (error) {
              console.error(`Error verificando asignaciones para room ${room.id}:`, error);
            }
          }
          return null;
        })
      );
      
      const sedesFiltradas = sedesConJornadas.filter(sede => sede !== null);
      setSedesConRoomsJornadas(sedesFiltradas);
    } catch (error) {
      console.error('Error cargando sedes con rooms y jornadas:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(''); // Limpiar errores previos
      
      // Obtener información del usuario desde localStorage
      let userRole = 'admin';
      let userGroups: string[] = [];
      
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsed = JSON.parse(userData);
          userRole = parsed.role || 'admin';
          userGroups = parsed.groups?.map((g: any) => g.id) || [];
        }
      } catch (error) {
        console.warn('Error parsing user data from localStorage:', error);
      }
      
      // Actualizar el estado del rol
      setUserRole(userRole);
      
      console.log('🔍 [FRONTEND] Usuario:', { role: userRole, groups: userGroups });
      
      // Enviar información del usuario en el body de la petición
      const groupsResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userRole: userRole,
          userGroups: userGroups
        })
      });
      
      if (!groupsResponse.ok) {
        throw new Error(`HTTP error! status: ${groupsResponse.status}`);
      }
      
      const groupsData = await groupsResponse.json();
      
      console.log('🔍 [FRONTEND] Respuesta de la API:', groupsData);
      
      if (groupsData.success) {
        setGroups(groupsData.groups || []);
        setUserRole(groupsData.userRole || 'admin');
        
        // Si es admin y tiene grupos, seleccionar el primero por defecto
        if (groupsData.userRole === 'admin' && groupsData.groups && groupsData.groups.length > 0) {
          setSelectedSedeForAdmin(groupsData.groups[0].id);
          setSelectedGroup(groupsData.groups[0].id); // También para el modal de crear room
        }
      } else {
        setError('Error cargando grupos: ' + (groupsData.error || 'Error desconocido'));
      }

      // Cargar rooms
      const roomsResponse = await fetch('/api/groups/rooms');
      
      if (!roomsResponse.ok) {
        throw new Error(`HTTP error! status: ${roomsResponse.status}`);
      }
      
      const roomsData = await roomsResponse.json();
      
      if (roomsData.success) {
        setRooms(roomsData.rooms || []);
      } else {
        setError('Error cargando rooms: ' + (roomsData.error || 'Error desconocido'));
      }

    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error de conexión: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setSubmitting(true);
    try {
      // Obtener token de autorización
      const token = localStorage.getItem('supabase.auth.token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name: newGroupName.trim() })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess('Sede creada exitosamente');
        setNewGroupName('');
        setShowCreateGroup(false);
        loadData(); // Recargar datos
      } else {
        setError('Error creando sede: ' + result.error);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !selectedGroup) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/groups/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          room_name: newRoomName.trim(),
          group_id: selectedGroup
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess('Room creado exitosamente');
        setNewRoomName('');
        setShowCreateRoom(false);
        loadData(); // Recargar datos
      } else {
        setError('Error creando room: ' + result.error);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoomsForGroup = (groupId: string) => {
    return rooms.filter(room => room.group_id === groupId);
  };

  const handleRoomClick = async (room: Room) => {
    try {
      console.log('🔍 [FRONTEND] Haciendo clic en room:', room.room_name);
      setSelectedRoom(room);
      setShowRoomConfig(true);
      setRoomConfigError(''); // Limpiar mensajes previos
      setRoomConfigSuccess(''); // Limpiar mensajes previos
      
      // Cargar asignaciones del room
      console.log('🔍 [FRONTEND] Cargando asignaciones para room ID:', room.id);
      const response = await fetch(`/api/rooms/${room.id}/assignments`);
      const data = await response.json();
      
      console.log('🔍 [FRONTEND] Respuesta del endpoint:', data);
      
      if (data.success) {
        setRoomAssignments(data.assignments || []);
        console.log('🔍 [FRONTEND] Asignaciones cargadas:', data.assignments?.length || 0);
      } else {
        console.error('❌ [FRONTEND] Error cargando asignaciones:', data.error);
        setRoomAssignments([]);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error en handleRoomClick:', error);
      setRoomAssignments([]);
    }
  };

  // NUEVA FUNCIÓN: Manejar clic en jornada
  const handleJornadaClick = async (jornada: string) => {
    if (!selectedRoom) return;
    
    console.log('🔍 [FRONTEND] Clic en jornada:', jornada);
    setSelectedJornada(jornada);
    
    // Cargar modelos disponibles del grupo
    try {
      const response = await fetch(`/api/groups/${selectedRoom.group_id}/models`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableModels(data.models || []);
        setShowModelSelector(true);
      } else {
        setError('Error cargando modelos: ' + data.error);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error cargando modelos:', error);
      setError('Error de conexión');
    }
  };

  // NUEVA FUNCIÓN: Manejar selección de modelo
  const handleModelSelect = async (model: any) => {
    setSelectedModel(model);
    
    // Verificar si la modelo ya tiene asignaciones
    try {
      const response = await fetch(`/api/models/${model.id}/assignments`);
      const data = await response.json();
      
      if (data.success && data.assignments.length > 0) {
        // Hay conflictos, mostrar modal de confirmación
        setConflictInfo({
          model: model,
          existingAssignments: data.assignments,
          newAssignment: {
            room_id: selectedRoom?.id,
            room_name: selectedRoom?.room_name,
            jornada: selectedJornada
          }
        });
        setShowConflictModal(true);
        setShowModelSelector(false);
      } else {
        // No hay conflictos, asignar directamente
        await assignModel(model, 'assign');
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error verificando asignaciones:', error);
      setError('Error verificando asignaciones');
    }
  };

  // NUEVA FUNCIÓN: Recargar solo las asignaciones del room (sin cerrar modal)
  const reloadRoomAssignments = async (room: Room) => {
    try {
      console.log('🔍 [FRONTEND] Recargando asignaciones para room ID:', room.id);
      const response = await fetch(`/api/rooms/${room.id}/assignments`);
      const data = await response.json();
      
      console.log('🔍 [FRONTEND] Respuesta del endpoint:', data);
      console.log('🔍 [FRONTEND] Asignaciones raw:', data.assignments);
      
      if (data.success) {
        setRoomAssignments(data.assignments || []);
        console.log('🔍 [FRONTEND] Asignaciones recargadas:', data.assignments?.length || 0);
        console.log('🔍 [FRONTEND] Estado actualizado con:', data.assignments);
      } else {
        console.error('❌ [FRONTEND] Error recargando asignaciones:', data.error);
        setRoomAssignments([]);
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error en reloadRoomAssignments:', error);
      setRoomAssignments([]);
    }
  };

  // NUEVA FUNCIÓN: Asignar modelo (mover o doblar)
  const assignModel = async (model: any, action: 'move' | 'assign') => {
    try {
      console.log('🔍 [FRONTEND] Asignando modelo:', {
        model_id: model.id,
        model_name: model.name,
        room_id: selectedRoom?.id,
        room_name: selectedRoom?.room_name,
        jornada: selectedJornada,
        action: action
      });

      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: model.id,
          room_id: selectedRoom?.id,
          jornada: selectedJornada,
          action: action // 'move' o 'assign'
        })
      });
      
      const data = await response.json();
      console.log('🔍 [FRONTEND] Respuesta de asignación:', data);
      
      if (data.success) {
        console.log('✅ [FRONTEND] Asignación exitosa, recargando asignaciones...');
        
        // Mostrar mensaje de éxito en el modal de configuración
        setRoomConfigSuccess(`Modelo ${action === 'move' ? 'movida' : 'asignada'} exitosamente`);
        setRoomConfigError(''); // Limpiar errores previos
        
        // Recargar solo las asignaciones del room (sin cerrar el modal)
        if (selectedRoom) {
          console.log('🔍 [FRONTEND] Llamando a reloadRoomAssignments...');
          await reloadRoomAssignments(selectedRoom);
          console.log('✅ [FRONTEND] reloadRoomAssignments completado');
        }
        
        // Cerrar modales de selección y conflicto
        setShowModelSelector(false);
        setShowConflictModal(false);
        setSelectedModel(null);
        setConflictInfo(null);
      } else {
        console.error('❌ [FRONTEND] Error en asignación:', data.error);
        setRoomConfigError('Error asignando modelo: ' + data.error);
        setRoomConfigSuccess(''); // Limpiar mensajes de éxito previos
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error asignando modelo:', error);
      setRoomConfigError('Error de conexión');
      setRoomConfigSuccess(''); // Limpiar mensajes de éxito previos
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Sedes</h1>
          <p className="mt-2 text-gray-600">Administra las sedes, rooms y configuraciones del sistema</p>
        </div>

        {/* Mensajes de error y éxito */}
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

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Acciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Para Super Admin: Selector de sedes con rooms y jornadas */}
          {userRole === 'super_admin' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tus Sedes</h2>
              <AppleDropdown
                options={sedesConRoomsJornadas.map(sede => ({
                  value: sede.id,
                  label: sede.name
                }))}
                value={selectedSedeForSuperAdmin}
                onChange={(value) => {
                  setSelectedSedeForSuperAdmin(value);
                  setSelectedGroup(value); // También actualizar para el modal de crear room
                }}
                placeholder="Selecciona una sede con rooms y jornadas"
              />
              {sedesConRoomsJornadas.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  No hay sedes con rooms y jornadas configurados
                </p>
              )}
            </div>
          )}

          {/* Para Admin: Selector de Sede */}
          {userRole === 'admin' && groups.length > 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Seleccionar Sede</h2>
              <AppleDropdown
                options={groups.map(group => ({
                  value: group.id,
                  label: group.name
                }))}
                value={selectedSedeForAdmin}
                onChange={(value) => {
                  setSelectedSedeForAdmin(value);
                  setSelectedGroup(value); // También actualizar para el modal de crear room
                }}
                placeholder="Selecciona una sede"
              />
            </div>
          )}

          {/* Para Admin con una sola sede: Mostrar sede actual */}
          {userRole === 'admin' && groups.length === 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Sede Asignada</h2>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700 font-medium">{groups[0]?.name}</span>
              </div>
            </div>
          )}

          {/* Para Super Admin: Crear Sede */}
          {userRole === 'super_admin' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear Nueva Sede</h2>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Crear Sede
              </button>
            </div>
          )}

          {/* Crear Room - Solo para Super Admin o Admin con sede seleccionada */}
          {(userRole === 'super_admin' || (userRole === 'admin' && (selectedSedeForAdmin || groups.length === 1))) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear Room</h2>
              <button
                onClick={() => setShowCreateRoom(true)}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
              >
                + Crear Room
              </button>
            </div>
          )}
        </div>

        {/* Lista de Sedes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Sedes Agencia Innova</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {groups.map((group) => (
              <div key={group.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
                    <p className="text-sm text-gray-500">
                      {getRoomsForGroup(group.id).length} rooms configurados
                    </p>
                  </div>
                </div>
                
                {/* Rooms de esta sede */}
                {getRoomsForGroup(group.id).length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Rooms disponibles:</p>
                    <div className="flex flex-wrap gap-2">
                      {getRoomsForGroup(group.id).map((room) => (
                        <button
                          key={room.id}
                          onClick={() => handleRoomClick(room)}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer"
                        >
                          {room.room_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Crear Sede */}
        {showCreateGroup && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear Nueva Sede</h2>
              
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Nombre de la Sede
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Sede Norte"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateGroup(false);
                      setNewGroupName('');
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creando...' : 'Crear Sede'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Crear Room */}
        {showCreateRoom && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear Room</h2>
              
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    {userRole === 'admin' ? 'Sede' : 'Seleccionar Sede'}
                  </label>
                  {userRole === 'admin' ? (
                    <div className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 bg-gray-50">
                      {groups.find(g => g.id === selectedGroup)?.name || 'Sede no seleccionada'}
                    </div>
                  ) : (
                    <AppleDropdown
                      options={groups.map(group => ({
                        value: group.id,
                        label: group.name
                      }))}
                      value={selectedGroup}
                      onChange={setSelectedGroup}
                      placeholder="Selecciona una sede"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">
                    Nombre del Room
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: ROOM01"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRoom(false);
                      setNewRoomName('');
                      setSelectedGroup('');
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedGroup}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creando...' : 'Crear Room'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Configuración de Room */}
        {showRoomConfig && selectedRoom && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Configuración de {selectedRoom.room_name}
                </h2>
                <button
                  onClick={() => {
                    setShowRoomConfig(false);
                    setSelectedRoom(null);
                    setRoomAssignments([]);
                    setRoomConfigError('');
                    setRoomConfigSuccess('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Mensajes de error y éxito del modal */}
              {roomConfigError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{roomConfigError}</p>
                    </div>
                  </div>
                </div>
              )}

              {roomConfigSuccess && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-800">{roomConfigSuccess}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Jornadas */}
              <div className="space-y-4">
                {['MAÑANA', 'TARDE', 'NOCHE'].map((jornada) => {
                  const assignmentsForJornada = roomAssignments.filter(
                    assignment => assignment.jornada === jornada
                  );
                  
                  return (
                    <div key={jornada} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        {jornada}
                      </h3>
                      
                      {assignmentsForJornada.length > 0 ? (
                        <div className="space-y-2">
                          {assignmentsForJornada.map((assignment, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {assignment.modelo_name || 'Modelo no especificada'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {assignment.modelo_email || 'Email no disponible'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Asignada
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="text-center py-4 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                          onClick={() => handleJornadaClick(jornada)}
                        >
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-500">No hay modelos asignadas</p>
                          <p className="text-xs text-gray-400 mt-1">Haz clic para asignar</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowRoomConfig(false);
                    setSelectedRoom(null);
                    setRoomAssignments([]);
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Selector de Modelos */}
        {showModelSelector && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Seleccionar Modelo para {selectedJornada}
                </h2>
                <button
                  onClick={() => {
                    setShowModelSelector(false);
                    setAvailableModels([]);
                    setSelectedJornada('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-2">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {model.name || 'Nombre no disponible'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {model.email || 'Email no disponible'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {availableModels.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">No hay modelos disponibles</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Conflicto */}
        {showConflictModal && conflictInfo && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Conflicto de Asignación
                </h2>
                <button
                  onClick={() => {
                    setShowConflictModal(false);
                    setConflictInfo(null);
                    setSelectedModel(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  <strong>{conflictInfo.model.name}</strong> ya está asignada en:
                </p>
                
                <div className="space-y-2">
                  {conflictInfo.existingAssignments.map((assignment: any, index: number) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-900">
                          {assignment.room_name} - {assignment.jornada}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-gray-600 mt-3">
                  ¿Qué deseas hacer?
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => assignModel(conflictInfo.model, 'move')}
                  className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Mover
                </button>
                <button
                  onClick={() => assignModel(conflictInfo.model, 'assign')}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Doblar
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-500">
                <p><strong>Mover:</strong> Desasigna de ubicación actual y asigna aquí</p>
                <p><strong>Doblar:</strong> Mantiene ubicación actual y asigna también aquí</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
