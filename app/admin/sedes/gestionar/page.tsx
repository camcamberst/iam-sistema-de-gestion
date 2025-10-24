"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppleDropdown from '@/components/ui/AppleDropdown';
import { getModelDisplayName } from '@/utils/model-display';

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
  
  // Estados de usuario y jerarquía
  const [userRole, setUserRole] = useState<string>('super_admin');
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [availableSedes, setAvailableSedes] = useState<any[]>([]);
  const [selectedSedeInfo, setSelectedSedeInfo] = useState<any>(null);
  const [sedeAdminInfo, setSedeAdminInfo] = useState<any>(null);
  
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
  
  // Estados para confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<any>(null);
  
  const router = useRouter();

  // Función para redirigir al portafolio de la modelo
  const handleModelClick = (modelId: string, modelEmail: string) => {
    // Redirigir al portafolio con filtro de modelo
    router.push(`/admin/sedes/portafolio?model=${modelId}&email=${encodeURIComponent(modelEmail)}`);
  };

  // Cargar datos iniciales
  useEffect(() => {
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();
  }, []);

  // Cargar datos después de cargar la información del usuario
  useEffect(() => {
    if (userRole && userGroups.length >= 0) {
      loadData();
      loadAvailableSedes();
    }
  }, [userRole, userGroups]);

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

  const loadAvailableSedes = async () => {
    try {
      // Obtener sedes disponibles según jerarquía del usuario
      const groupsResponse = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userRole: userRole, 
          userGroups: userGroups 
        })
      });
      const groupsData = await groupsResponse.json();
      
      if (!groupsData.success) return;
      
      // Filtrar sedes operativas (excluir Otros y Satélites)
      const sedesOperativas = groupsData.groups.filter((group: any) => 
        group.name !== 'Otros' && 
        group.name !== 'Satélites'
      );
      setAvailableSedes(sedesOperativas);
      
      // Iniciar sin sede seleccionada (estado "Todas las sedes")
      setSelectedSede('');
      setSelectedGroup('');
    } catch (error) {
      console.error('Error cargando sedes disponibles:', error);
    }
  };

  const loadRoomsData = async () => {
    try {
      console.log('🔄 [FRONTEND] Recargando solo rooms...');
      
      // Cargar rooms
      const roomsResponse = await fetch('/api/groups/rooms');
      
      if (!roomsResponse.ok) {
        throw new Error(`HTTP error! status: ${roomsResponse.status}`);
      }
      
      const roomsData = await roomsResponse.json();
      
      if (roomsData.success) {
        setRooms(roomsData.rooms || []);
        console.log('✅ [FRONTEND] Rooms actualizados:', roomsData.rooms?.length || 0);
      } else {
        console.error('❌ [FRONTEND] Error cargando rooms:', roomsData.error);
      }
    } catch (err) {
      console.error('❌ [FRONTEND] Error recargando rooms:', err);
    }
  };

  const loadSedeInfo = async (sedeId: string) => {
    try {
      // Obtener información de la sede
      const sede = availableSedes.find(s => s.id === sedeId);
      if (!sede) return;

      // Obtener rooms de esta sede
      const roomsResponse = await fetch('/api/groups/rooms');
      const roomsData = await roomsResponse.json();
      
      if (roomsData.success) {
        const sedeRooms = roomsData.rooms.filter((room: any) => room.group_id === sedeId);
        setSelectedSedeInfo({
          ...sede,
          rooms: sedeRooms
        });
      }

      // Obtener información del admin asignado a esta sede
      const usersResponse = await fetch('/api/users');
      const usersData = await usersResponse.json();
      
      if (usersData.success) {
        console.log('🔍 [DEBUG] Buscando admin para sede:', sedeId);
        console.log('🔍 [DEBUG] Todos los usuarios:', usersData.users.length);
        
        // Filtrar solo admins (no super_admins)
        const admins = usersData.users.filter((user: any) => user.role === 'admin');
        console.log('🔍 [DEBUG] Solo admins:', admins.length);
        
        // Buscar TODOS los admins asignados a esta sede específica
        const adminsAsignados = admins.filter((user: any) => {
          const tieneEstaSede = user.user_groups?.some((ug: any) => ug.id === sedeId);
          console.log(`🔍 [DEBUG] Admin ${user.name}:`, {
            user_groups: user.user_groups,
            tieneEstaSede,
            sedeId,
            sedesAsignadas: user.user_groups?.length || 0
          });
          return tieneEstaSede;
        });
        
        console.log('🔍 [DEBUG] Admins asignados a esta sede:', adminsAsignados.length);
        
        // REGLA INTELIGENTE: Si hay múltiples admins, elegir el que tenga menos sedes asignadas
        let adminAsignado = null;
        if (adminsAsignados.length > 0) {
          if (adminsAsignados.length === 1) {
            adminAsignado = adminsAsignados[0];
            console.log('🔍 [DEBUG] Solo un admin asignado:', adminAsignado.name);
          } else {
            // Múltiples admins: elegir el que tenga menos sedes asignadas
            adminAsignado = adminsAsignados.reduce((menor: any, actual: any) => {
              const sedesMenor = menor.user_groups?.length || 0;
              const sedesActual = actual.user_groups?.length || 0;
              console.log(`🔍 [DEBUG] Comparando: ${menor.name} (${sedesMenor} sedes) vs ${actual.name} (${sedesActual} sedes)`);
              return sedesActual < sedesMenor ? actual : menor;
            });
            console.log('🔍 [DEBUG] Admin seleccionado (menos sedes):', adminAsignado.name, `(${adminAsignado.user_groups?.length || 0} sedes)`);
          }
        }
        
        console.log('🔍 [DEBUG] Admin final seleccionado:', adminAsignado);
        setSedeAdminInfo(adminAsignado);
      }
    } catch (error) {
      console.error('Error cargando información de la sede:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(''); // Limpiar errores previos
      
      // Cargar grupos (sedes) según jerarquía del usuario
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
      
      if (groupsData.success) {
        // Filtrar grupos operativos
        const filteredGroups = (groupsData.groups || []).filter((group: any) => 
          group.name !== 'Otros' && group.name !== 'Satélites'
        );
        
        setGroups(filteredGroups);
        
        // Seleccionar primera sede por defecto solo si hay sedes disponibles
        if (filteredGroups.length > 0) {
          setSelectedGroup(filteredGroups[0].id);
        }
      } else {
        setError('Error cargando sedes: ' + (groupsData.error || 'Error desconocido'));
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
        
        // Actualización optimizada: solo recargar rooms y sede info
        await Promise.all([
          loadRoomsData(), // Recargar lista de rooms
          selectedSede ? loadSedeInfo(selectedSede) : Promise.resolve() // Actualizar info de sede seleccionada
        ]);
      } else {
        // Personalizar mensaje de error para duplicados
        if (result.error && result.error.includes('ya existe')) {
          setError('Este Room ya existe');
        } else {
          setError('Error creando room: ' + result.error);
        }
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
      
      // Cargar asignaciones del room usando nueva API
      console.log('🔍 [FRONTEND] Cargando asignaciones para room ID:', room.id);
      const response = await fetch(`/api/room-assignments?roomId=${room.id}`);
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
    
    // Verificar si la modelo ya tiene asignaciones usando nueva API
    try {
      // Obtener todas las asignaciones de la modelo
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
  const reloadRoomAssignments = async (room: Room, delay: number = 0) => {
    try {
      // Delay opcional para casos específicos
      if (delay > 0) {
        console.log(`⏳ [FRONTEND] Esperando ${delay}ms para sincronización...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log('🔍 [FRONTEND] Recargando asignaciones para room ID:', room.id);
      const response = await fetch(`/api/room-assignments?roomId=${room.id}`);
      const data = await response.json();
      
      console.log('🔍 [FRONTEND] Respuesta del endpoint:', data);
      console.log('🔍 [FRONTEND] Asignaciones raw:', data.assignments);
      
      if (data.success) {
        // Nueva API ya devuelve solo asignaciones válidas (no hay is_active)
        setRoomAssignments(data.assignments || []);
        console.log('🔍 [FRONTEND] Asignaciones recibidas:', data.assignments?.length || 0);
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

  // NUEVA FUNCIÓN: Asignar modelo (assign o move)
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

      // Preparar payload para nueva API
      const payload: any = {
        action: action,
        model_id: model.id,
        room_id: selectedRoom?.id,
        jornada: selectedJornada
      };

      // Si es 'move', necesitamos datos de origen (de conflictInfo)
      if (action === 'move' && conflictInfo?.existingAssignments?.length > 0) {
        const existingAssignment = conflictInfo.existingAssignments[0];
        payload.from_room_id = existingAssignment.room_id;
        payload.from_jornada = existingAssignment.jornada;
      }

      const response = await fetch('/api/room-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log('🔍 [FRONTEND] Respuesta de asignación:', data);
      
      if (data.success) {
        console.log('✅ [FRONTEND] Asignación exitosa, recargando asignaciones...');
        
        // Mostrar mensaje de éxito en el modal de configuración
        setRoomConfigSuccess(`Modelo ${action === 'move' ? 'movida' : 'asignada'} exitosamente`);
        setRoomConfigError(''); // Limpiar errores previos
        
        // Recargar asignaciones inmediatamente (sin delay)
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

  // NUEVA FUNCIÓN: Mostrar confirmación de eliminación
  const confirmDeleteAssignment = (assignment: any) => {
    setAssignmentToDelete(assignment);
    setShowDeleteConfirm(true);
  };

  // NUEVA FUNCIÓN: Eliminar asignación de modelo (ejecutada después de confirmación)
  const deleteModelAssignment = async () => {
    if (!assignmentToDelete || !selectedRoom) return;

    // Prevenir múltiples llamadas simultáneas
    if (assignmentToDelete.isDeleting) {
      console.log('⚠️ [FRONTEND] Eliminación ya en progreso, ignorando...');
      return;
    }

    // Marcar como en proceso de eliminación
    setAssignmentToDelete({ ...assignmentToDelete, isDeleting: true });

    try {
      console.log('🔍 [FRONTEND] Eliminando asignación:', {
        model_id: assignmentToDelete.model_id,
        model_name: assignmentToDelete.model_name,
        room_id: selectedRoom.id,
        room_name: selectedRoom.room_name,
        jornada: assignmentToDelete.jornada
      });

      const response = await fetch('/api/room-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          model_id: assignmentToDelete.model_id,
          room_id: selectedRoom.id,
          jornada: assignmentToDelete.jornada
        })
      });
      
      const data = await response.json();
      console.log('🔍 [FRONTEND] Respuesta de eliminación:', data);
      
      if (data.success) {
        console.log('✅ [FRONTEND] Eliminación exitosa, recargando asignaciones...');
        
        // Mostrar mensaje de éxito en el modal de configuración
        setRoomConfigSuccess(`Modelo eliminada exitosamente de ${assignmentToDelete.jornada}`);
        setRoomConfigError(''); // Limpiar errores previos
        
        // Recargar asignaciones inmediatamente
        console.log('🔄 [FRONTEND] Recargando asignaciones para sincronizar UI...');
        await reloadRoomAssignments(selectedRoom);
        console.log('✅ [FRONTEND] Sincronización completada');
      } else {
        console.error('❌ [FRONTEND] Error en eliminación:', data.error);
        setRoomConfigError('Error eliminando modelo: ' + data.error);
        setRoomConfigSuccess(''); // Limpiar mensajes de éxito previos
      }
    } catch (error) {
      console.error('❌ [FRONTEND] Error eliminando modelo:', error);
      setRoomConfigError('Error de conexión');
      setRoomConfigSuccess(''); // Limpiar mensajes de éxito previos
    } finally {
      // Cerrar modal de confirmación
      setShowDeleteConfirm(false);
      setAssignmentToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <div className="mb-16">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-2xl blur-xl"></div>
            <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 dark:border-gray-700/20 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                    Gestión de Sedes
                  </h1>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Administra las sedes, rooms y configuraciones del sistema</p>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                    No tienes sedes asignadas para gestionar. Contacta al Super Admin para que te asigne sedes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Acciones principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Columna Izquierda: Selector de Sedes */}
          <div className="flex flex-col h-full">
            <div className="relative flex-1">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-2xl blur-sm"></div>
              <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 h-full flex flex-col">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Seleccionar Sede</h2>
                </div>
              <AppleDropdown
                options={availableSedes.map(sede => ({
                  value: sede.id,
                  label: sede.name
                }))}
                value={selectedSede}
                onChange={(value) => {
                  setSelectedSede(value);
                  setSelectedGroup(value);
                  if (value) {
                    loadSedeInfo(value);
                  } else {
                    setSelectedSedeInfo(null);
                    setSedeAdminInfo(null);
                  }
                }}
                placeholder="Selecciona una sede para gestionar"
              />
              {availableSedes.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  No hay sedes disponibles para gestionar
                </p>
              )}
              </div>
            </div>
          </div>

          {/* Columna Derecha: Crear Sede y Crear Room */}
          <div className="flex flex-col space-y-6 h-full">
            {/* Crear Nueva Sede */}
            <div className="relative flex-1">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-500/5 to-slate-500/5 rounded-2xl blur-sm"></div>
              <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 h-full flex flex-col">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="w-6 h-6 bg-gradient-to-br from-gray-600 to-slate-700 rounded-md flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900">Crear Nueva Sede</h2>
                </div>
                <div className="mt-auto">
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="w-full bg-gradient-to-r from-gray-700 to-slate-800 text-white py-2 px-3 rounded-lg hover:from-gray-800 hover:to-slate-900 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-sm font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    + Crear Sede
                  </button>
                </div>
              </div>
            </div>

            {/* Crear Room */}
            {selectedSede && (
              <div className="relative flex-1">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-2xl blur-sm"></div>
                <div className="relative bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6 h-full flex flex-col">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">Crear Room</h2>
                  </div>
                  <div className="mt-auto">
                    <button
                      onClick={() => setShowCreateRoom(true)}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2 px-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                      + Crear Room
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información de la Sede Seleccionada */}
        {selectedSedeInfo && (
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-xl blur-sm"></div>
            <div className="relative bg-white/80 backdrop-blur-sm rounded-lg shadow-md border border-white/20 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedSedeInfo.name}</h2>
                    <p className="text-xs text-gray-500">
                      {selectedSedeInfo.rooms?.length || 0} rooms configurados
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 bg-blue-100 px-2 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-blue-700 font-medium">Activa</span>
                </div>
              </div>

            {/* Información del Admin Asignado */}
            {sedeAdminInfo ? (
              <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm rounded-lg p-4 mb-4 border border-blue-200/30">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Admin Asignado</h3>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-semibold text-sm">
                      {sedeAdminInfo.name?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{sedeAdminInfo.name}</p>
                    <p className="text-xs text-gray-600">{sedeAdminInfo.email}</p>
                    <p className="text-xs text-blue-600 font-medium">
                      {sedeAdminInfo.user_groups?.length || 0} sede{(sedeAdminInfo.user_groups?.length || 0) !== 1 ? 's' : ''} asignada{(sedeAdminInfo.user_groups?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-yellow-50/80 to-orange-50/80 backdrop-blur-sm rounded-xl p-5 mb-6 border border-yellow-200/30">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-yellow-800">No hay admin asignado a esta sede</p>
                </div>
              </div>
            )}

            {/* Rooms de la Sede */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Rooms Disponibles</h3>
              </div>
              {selectedSedeInfo.rooms && selectedSedeInfo.rooms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedSedeInfo.rooms.map((room: any) => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomClick(room)}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 hover:from-gray-200 hover:to-slate-200 hover:text-gray-900 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 border border-gray-200/50"
                    >
                      <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {room.room_name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-gradient-to-r from-gray-50/80 to-slate-50/80 backdrop-blur-sm rounded-xl p-6 text-center border border-gray-200/30">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600">No hay rooms configurados en esta sede</p>
                  <p className="text-xs text-gray-500 mt-1">Usa el botón "Crear Room" para agregar rooms</p>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Lista de Sedes - OCULTA: La información está en el dropdown "Tus Sedes" */}
        {/* 
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
        */}

        {/* Modal Crear Sede */}
        {showCreateGroup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-500/10 to-slate-500/10 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/90 backdrop-blur-sm border border-white/20 rounded-3xl shadow-2xl p-8 w-full max-w-md">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-slate-700 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Crear Nueva Sede</h2>
                </div>
              
              <form onSubmit={handleCreateGroup} className="space-y-6">
                {/* Mensajes de estado dentro del modal */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm text-green-700 font-medium">{success}</p>
                    </div>
                  </div>
                )}
              
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2">
                    Nombre de la Sede
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="Ej: Sede Norte"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateGroup(false);
                      setNewGroupName('');
                    }}
                    className="flex-1 bg-gray-100/80 backdrop-blur-sm text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200/80 transition-all duration-200 font-medium border border-gray-200/50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-gray-700 to-slate-800 text-white py-3 px-4 rounded-xl hover:from-gray-800 hover:to-slate-900 transition-all duration-200 disabled:opacity-50 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {submitting ? 'Creando...' : 'Crear Sede'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal Crear Room */}
        {showCreateRoom && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/90 backdrop-blur-sm border border-white/20 rounded-3xl shadow-2xl p-8 w-full max-w-md">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Crear Room</h2>
                </div>
              
              <form onSubmit={handleCreateRoom} className="space-y-6">
                {/* Mensajes de estado dentro del modal */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-sm text-green-700 font-medium">{success}</p>
                    </div>
                  </div>
                )}
              
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2">
                    Sede Seleccionada
                  </label>
                  <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 bg-white/50 backdrop-blur-sm">
                    {groups.find(g => g.id === selectedGroup)?.name || 'Ninguna sede seleccionada'}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2">
                    Nombre del Room
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                    placeholder="Ej: ROOM01"
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateRoom(false);
                      setNewRoomName('');
                      setSelectedGroup('');
                    }}
                    className="flex-1 bg-gray-100/80 backdrop-blur-sm text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200/80 transition-all duration-200 font-medium border border-gray-200/50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedGroup}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {submitting ? 'Creando...' : 'Crear Room'}
                  </button>
                </div>
              </form>
              </div>
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
                          {assignmentsForJornada.map((assignment) => (
                            <div key={assignment.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div 
                                  className="cursor-pointer hover:bg-blue-50 rounded-lg p-2 -m-2 transition-colors group"
                                  onClick={() => handleModelClick(assignment.model_id, assignment.model_email)}
                                  title="Ver portafolio de la modelo"
                                >
                                  <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                                    {getModelDisplayName(assignment.model_email) || assignment.model_name || 'Modelo no especificada'}
                                  </p>
                                  <p className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors">
                                    {assignment.model_email || 'Email no disponible'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Asignada
                                </span>
                                <button
                                  onClick={() => confirmDeleteAssignment(assignment)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors group bg-red-100 hover:bg-red-200 cursor-pointer"
                                  title="Eliminar modelo de esta jornada"
                                >
                                  <svg className="w-4 h-4 text-red-600 group-hover:text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => handleJornadaClick(jornada)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">No hay modelos asignadas</p>
                              <p className="text-xs text-gray-400">Haz clic para asignar</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Disponible
                            </span>
                          </div>
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

        {/* Modal de Confirmación de Eliminación */}
        {showDeleteConfirm && assignmentToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/90 backdrop-blur-sm border border-white/20 rounded-3xl shadow-2xl p-8 w-full max-w-md">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Confirmar Eliminación</h2>
                </div>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-4">
                    ¿Estás seguro de que deseas eliminar a <strong>{assignmentToDelete.model_name}</strong> de la jornada <strong>{assignmentToDelete.jornada}</strong>?
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{assignmentToDelete.model_name}</p>
                        <p className="text-xs text-gray-500">{assignmentToDelete.model_email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setAssignmentToDelete(null);
                    }}
                    className="flex-1 bg-gray-100/80 backdrop-blur-sm text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200/80 transition-all duration-200 font-medium border border-gray-200/50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={deleteModelAssignment}
                    disabled={assignmentToDelete?.isDeleting}
                    className={`flex-1 py-3 px-4 rounded-xl transition-all duration-200 font-medium shadow-lg ${
                      assignmentToDelete?.isDeleting
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 hover:shadow-xl transform hover:-translate-y-0.5'
                    }`}
                  >
                    {assignmentToDelete?.isDeleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
