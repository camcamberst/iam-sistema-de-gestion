"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import AppleDropdown from '@/components/ui/AppleDropdown';
import StandardModal from '@/components/ui/StandardModal';
import PageHeader from "@/components/ui/PageHeader";
import GlassCard from "@/components/ui/GlassCard";
import { 
  Building2, 
  Building,
  MapPin,
  Video,
  Plus, 
  Info, 
  AlertTriangle, 
  Users, 
  History, 
  SlidersHorizontal, 
  Settings, 
  Key, 
  Trash2, 
  Edit, 
  X, 
  XCircle, 
  Check 
} from 'lucide-react';
import { getModelDisplayName } from '@/utils/model-display';
import { supabase } from '@/lib/supabase';

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
  const [userRole, setUserRole] = useState<string>('');
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
  const [showDeleteRoomModal, setShowDeleteRoomModal] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<any>(null);
  
  // Estados para editar/eliminar sede
  const [showEditSedeModal, setShowEditSedeModal] = useState(false);
  const [showDeleteSedeModal, setShowDeleteSedeModal] = useState(false);
  const [sedeToEdit, setSedeToEdit] = useState<any>(null);
  const [sedeToDelete, setSedeToDelete] = useState<any>(null);
  const [editSedeName, setEditSedeName] = useState('');
  const [editSedeDescription, setEditSedeDescription] = useState('');
  const [editSedeActive, setEditSedeActive] = useState(true);
  const [userAffiliateStudioId, setUserAffiliateStudioId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  const router = useRouter();

  // Función para redirigir al portafolio de la modelo
  const handleModelClick = (modelId: string, modelEmail: string) => {
    // Redirigir al portafolio con filtro de modelo
    router.push(`/admin/sedes/portafolio?model=${modelId}&email=${encodeURIComponent(modelEmail)}`);
  };

  // Cargar datos iniciales
  useEffect(() => {
    setIsMounted(true);
    // Scroll automático al top cuando se carga la página
    window.scrollTo(0, 0);
    
    loadUserInfo();
  }, []);

  // Cargar datos después de cargar la información del usuario
  useEffect(() => {
    if (userRole && userRole !== '') {
      console.log('🔍 [GESTIONAR-SEDES] Ejecutando useEffect con:', { userRole, userGroups });
      loadData();
      loadAvailableSedes();
    }
  }, [userRole, userGroups]);

  const loadUserInfo = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsed = JSON.parse(userData);
        console.log('🔍 [GESTIONAR-SEDES] Datos del usuario desde localStorage:', {
          id: parsed.id,
          role: parsed.role,
          groups: parsed.groups
        });
        
        setUserRole(parsed.role || 'admin');
        
        // Extraer IDs de grupos correctamente
        const groupIds = parsed.groups?.map((g: any) => g.id) || [];
        console.log('🔍 [GESTIONAR-SEDES] IDs de grupos extraídos:', groupIds);
        
        setUserGroups(groupIds);
        setUserId(parsed.id || '');
      }

      // Obtener affiliate_studio_id del usuario desde la base de datos
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('affiliate_studio_id')
          .eq('id', session.user.id)
          .single();
        
        if (userData) {
          setUserAffiliateStudioId(userData.affiliate_studio_id);
        }
      }
    } catch (error) {
      console.warn('Error parsing user data from localStorage:', error);
    }
  };

  const loadAvailableSedes = async () => {
    try {
      // Verificar que tenemos datos válidos del usuario
      if (!userRole || userRole === '') {
        console.log('🔍 [GESTIONAR-SEDES] Saltando carga de sedes - userRole vacío');
        return;
      }
      
      console.log('🔍 [GESTIONAR-SEDES] Cargando sedes disponibles con:', {
        userRole,
        userGroups
      });
      
      // Obtener token de autenticación para que el filtro de afiliado funcione
      const { data: { session } } = await supabase.auth.getSession();
      
      // Usar GET con autenticación para que el filtro de afiliado funcione correctamente
      const groupsResponse = await fetch('/api/groups', {
        method: 'GET',
        headers: session?.access_token ? {
          'Authorization': `Bearer ${session.access_token}`
        } : {}
      });
      const groupsData = await groupsResponse.json();
      
      console.log('🔍 [GESTIONAR-SEDES] Respuesta de API:', groupsData);
      
      if (!groupsData.success) return;
      
      // Filtrar sedes operativas (excluir Otros y Satélites)
      const sedesOperativas = groupsData.groups.filter((group: any) => 
        group.name !== 'Otros' && 
        group.name !== 'Satélites'
      );
      
      console.log('🔍 [GESTIONAR-SEDES] Sedes operativas filtradas:', sedesOperativas);
      
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
      // Usar autenticación para que el filtro de afiliado funcione
      const { data: { session: usersSession } } = await supabase.auth.getSession();
      const usersResponse = await fetch('/api/users', {
        headers: usersSession?.access_token ? {
          'Authorization': `Bearer ${usersSession.access_token}`
        } : {}
      });
      const usersData = await usersResponse.json();
      
      if (usersData.success) {
        console.log('🔍 [DEBUG] Buscando admin para sede:', sedeId);
        console.log('🔍 [DEBUG] Todos los usuarios:', usersData.users.length);
        
        // Filtrar solo admins (no super_admins)
        const admins = usersData.users.filter((user: any) => user.role === 'admin');
        console.log('🔍 [DEBUG] Solo admins:', admins.length);
        
        // Buscar TODOS los admins asignados a esta sede específica
        const adminsAsignados = admins.filter((user: any) => {
          // La API retorna tanto 'groups' como 'user_groups' con estructura plana: [{ id, name }]
          // Verificar en ambos campos por compatibilidad
          const userGroups = user.user_groups || user.groups || [];
          const tieneEstaSede = userGroups.some((ug: any) => {
            // Verificar ambas estructuras posibles (anidada o plana)
            const groupId = ug.groups?.id || ug.id;
            return groupId === sedeId;
          });
          console.log(`🔍 [DEBUG] Admin ${user.name}:`, {
            user_groups: user.user_groups,
            groups: user.groups,
            userGroups_processed: userGroups,
            tieneEstaSede,
            sedeId,
            sedesAsignadas: userGroups.length,
            estructura: userGroups[0] ? Object.keys(userGroups[0]) : 'sin grupos'
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
        
        // Si no se encontró admin, limpiar el estado
        if (!adminAsignado) {
          console.log('⚠️ [DEBUG] No se encontró admin asignado a esta sede');
          setSedeAdminInfo(null);
        } else {
          console.log('✅ [DEBUG] Admin encontrado y asignado:', adminAsignado.name);
          setSedeAdminInfo(adminAsignado);
        }
      } else {
        // Si no hay usuarios, limpiar admin
        setSedeAdminInfo(null);
      }
    } catch (error) {
      console.error('Error cargando información de la sede:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(''); // Limpiar errores previos
      
      // Obtener token de autenticación para que el filtro de afiliado funcione
      const { data: { session } } = await supabase.auth.getSession();
      
      // Cargar grupos (sedes) usando GET con autenticación para que el filtro de afiliado funcione
      const groupsResponse = await fetch('/api/groups', {
        method: 'GET',
        headers: session?.access_token ? {
          'Authorization': `Bearer ${session.access_token}`
        } : {}
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
      // Obtener token de autorización desde Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ name: newGroupName.trim() })
      });

      const result = await response.json();
      
      console.log('🔍 [FRONTEND] Respuesta de creación de grupo:', result);
      
      if (result.success) {
        setSuccess('Sede creada exitosamente');
        setNewGroupName('');
        setShowCreateGroup(false);
        setError(''); // Limpiar errores previos
        
        // Guardar el nombre de la sede creada antes de limpiar
        const createdSedeName = newGroupName.trim();
        
        // Recargar datos y sedes disponibles primero
        await loadAvailableSedes();
        await loadData();
        
        // Esperar un momento para que el estado se actualice
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Si se creó exitosamente, seleccionar la nueva sede automáticamente
        if (result.group && result.group.id) {
          console.log('🔍 [FRONTEND] Seleccionando nueva sede creada:', result.group.id);
          setSelectedSede(result.group.id);
          setSelectedGroup(result.group.id);
          // Cargar información de la nueva sede
          await loadSedeInfo(result.group.id);
        } else {
          // Si no viene el grupo en la respuesta, buscar la sede recién creada por nombre
          // Necesitamos obtener las sedes actualizadas directamente de la API
          const { data: { session: refreshSession } } = await supabase.auth.getSession();
          const refreshResponse = await fetch('/api/groups', {
            method: 'GET',
            headers: refreshSession?.access_token ? {
              'Authorization': `Bearer ${refreshSession.access_token}`
            } : {}
          });
          const refreshData = await refreshResponse.json();
          
          if (refreshData.success) {
            const sedesOperativas = refreshData.groups.filter((group: any) => 
              group.name !== 'Otros' && group.name !== 'Satélites'
            );
            const newSede = sedesOperativas.find((s: any) => s.name === createdSedeName);
            if (newSede) {
              console.log('🔍 [FRONTEND] Encontrada nueva sede por nombre:', newSede.id);
              setSelectedSede(newSede.id);
              setSelectedGroup(newSede.id);
              await loadSedeInfo(newSede.id);
            }
          }
        }
      } else {
        console.error('❌ [FRONTEND] Error creando sede:', result.error);
        setError('Error creando sede: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('❌ [FRONTEND] Error en handleCreateGroup:', err);
      setError('Error de conexión: ' + (err instanceof Error ? err.message : 'Error desconocido'));
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

  // Función para editar sede
  const handleEditSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sedeToEdit || !editSedeName.trim()) return;

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/groups', {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({
          id: sedeToEdit.id,
          name: editSedeName.trim(),
          description: editSedeDescription.trim() || null,
          is_active: editSedeActive
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess('Sede actualizada exitosamente');
        setShowEditSedeModal(false);
        setSedeToEdit(null);
        setEditSedeName('');
        setEditSedeDescription('');
        setError('');
        
        // Recargar datos
        await loadAvailableSedes();
        await loadData();
        
        // Si la sede editada está seleccionada, recargar su información
        if (selectedSede === sedeToEdit.id) {
          await loadSedeInfo(sedeToEdit.id);
        }
      } else {
        setError('Error actualizando sede: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('❌ [FRONTEND] Error en handleEditSede:', err);
      setError('Error actualizando sede: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  // Función para eliminar sede
  const handleDeleteSede = async () => {
    if (!sedeToDelete) return;

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/groups?id=${sedeToDelete.id}`, {
        method: 'DELETE',
        headers: headers
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess('Sede eliminada exitosamente');
        setShowDeleteSedeModal(false);
        setSedeToDelete(null);
        setError('');
        
        // Limpiar selección si se eliminó la sede seleccionada
        if (selectedSede === sedeToDelete.id) {
          setSelectedSede('');
          setSelectedGroup('');
          setSelectedSedeInfo(null);
          setSedeAdminInfo(null);
        }
        
        // Recargar datos
        await loadAvailableSedes();
        await loadData();
      } else {
        setError('Error eliminando sede: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error('❌ [FRONTEND] Error en handleDeleteSede:', err);
      setError('Error eliminando sede: ' + (err instanceof Error ? err.message : 'Error desconocido'));
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
    // Agregamos cache-busting para asegurar datos frescos después de actualizaciones
    try {
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(`/api/groups/${selectedRoom.group_id}/models${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ [FRONTEND] Modelos cargados para grupo ${selectedRoom.group_id}:`, data.models?.length || 0);
        setAvailableModels(data.models || []);
        setShowModelSelector(true);
      } else {
        console.error('❌ [FRONTEND] Error en respuesta:', data.error);
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
        // Filtrar asignaciones que coinciden exactamente con la jornada seleccionada
        const conflictoJornada = data.assignments.filter(
          (a: any) => a.jornada.toUpperCase() === selectedJornada.toUpperCase()
        );

        if (conflictoJornada.length > 0) {
          // Hay conflicto real de jornada (físicamente no puede estar en dos rooms al mismo tiempo)
          setConflictInfo({
            model: model,
            existingAssignments: conflictoJornada,
            newAssignment: {
              room_id: selectedRoom?.id,
              room_name: selectedRoom?.room_name,
              jornada: selectedJornada
            }
          });
          setShowConflictModal(true);
          setShowModelSelector(false);
        } else {
          // No hay conflicto de jornada (está asignada en otra jornada diferente), asignar directamente
          await assignModel(model, 'assign');
        }
      } else {
        // No tiene asignaciones previas, asignar directamente
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

  // NUEVA FUNCIÓN: Eliminar room
  const handleDeleteRoom = async () => {
    console.log('🔍 [DELETE-ROOM] handleDeleteRoom ejecutándose con:', roomToDelete);
    
    if (!roomToDelete) {
      console.log('❌ [DELETE-ROOM] No hay room para eliminar');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      console.log('🔍 [FRONTEND] Eliminando room:', {
        room_id: roomToDelete.id,
        room_name: roomToDelete.room_name,
        group_id: roomToDelete.group_id
      });

      const response = await fetch(`/api/groups/rooms?id=${roomToDelete.id}`, {
        method: 'DELETE'
      });

      console.log('🔍 [DELETE-ROOM] Respuesta de API:', response.status);

      const result = await response.json();
      console.log('🔍 [DELETE-ROOM] Resultado:', result);

      if (result.success) {
        setSuccess(result.message);
        setError('');
        
        // Recargar datos de la sede actual para actualizar la lista de rooms
        if (selectedSede) {
          await loadSedeInfo(selectedSede);
        }
        
        // Cerrar modal
        setShowDeleteRoomModal(false);
        setRoomToDelete(null);
      } else {
        setError(result.error || 'Error eliminando room');
        setSuccess('');
      }
    } catch (err) {
      console.error('❌ [DELETE-ROOM] Error eliminando room:', err);
      setError('Error de conexión eliminando room');
      setSuccess('');
    } finally {
      setSubmitting(false);
    }
  };

  const headerActions = (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      {(userRole === 'super_admin' || userRole === 'superadmin_aff') && (
        <button
          onClick={() => setShowCreateGroup(true)}
          className="btn-apple-primary flex items-center justify-center h-[34px] px-6 text-sm font-semibold whitespace-nowrap active:scale-[0.98] transition-all"
        >
          <span>Crear Sede</span>
        </button>
      )}
      {selectedSede && (
        <button
          onClick={() => setShowCreateRoom(true)}
          className="bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 border border-white/20 dark:border-white/10 text-gray-800 dark:text-gray-200 flex items-center justify-center h-[34px] px-6 text-sm font-semibold rounded-full active:scale-[0.98] transition-all"
        >
          <span>Crear Room</span>
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center pt-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-8 pt-16">
        {/* Header */}
        <PageHeader 
          title="Gestión de Sedes"
          subtitle="Administra las sedes, rooms y asignaciones del sistema en tiempo real"
          icon={<Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />}
          glow="admin"
          actions={headerActions}
        />

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


        {/* Caja de Selección Unificada (Regla 17) */}
        <div className="mb-8 relative z-20 max-w-[360px]">
          {/* Cabecera del panel de selección (Fuera de la caja con tamaño estándar) */}
          <div className="flex items-center space-x-2 min-w-0 mb-4 px-1">
            <MapPin className="w-[22px] h-[22px] text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.4)] shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Seleccionar Sede
            </h2>
          </div>

          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl p-4 sm:p-5 backdrop-blur-3xl shadow-sm">
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
              placeholder="Selecciona una sede de la lista..."
              className="text-sm"
            />
            {availableSedes.length === 0 && (
              <p className="text-xs text-red-500 dark:text-red-400 font-semibold mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                No tienes sedes asignadas ni disponibles para gestionar
              </p>
            )}
          </div>
        </div>

        {/* Información de la Sede Seleccionada */}
        {/* Información de la Sede Seleccionada */}
        {selectedSedeInfo && (
          <>
            {/* Cabecera del panel de sede (Fuera de la caja y sin subtítulo) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 px-1">
              <div className="flex items-center space-x-2 min-w-0">
                <Building className="w-[22px] h-[22px] text-purple-500 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)] shrink-0" />
                <div className="min-w-0 flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                    {selectedSedeInfo.name}
                  </h2>
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
              </div>

              {(userRole === 'super_admin' || userRole === 'superadmin_aff') && (
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-full border border-black/5 dark:border-white/5 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      setSedeToEdit(selectedSedeInfo);
                      setEditSedeName(selectedSedeInfo.name);
                      setEditSedeDescription(selectedSedeInfo.description || '');
                      setEditSedeActive(selectedSedeInfo.is_active !== false);
                      setShowEditSedeModal(true);
                    }}
                    className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] active:scale-95 transition-all"
                    title="Editar sede"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setSedeToDelete(selectedSedeInfo);
                      setShowDeleteSedeModal(true);
                    }}
                    className="px-3 py-1 rounded-full text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                    title="Eliminar Sede"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            <GlassCard
              padding="lg"
              className="mb-10 border border-white/20 dark:border-white/10 shadow-sm relative overflow-hidden"
              auroraEffect={true}
            >
              {/* Contenedor concéntrico: Información del Admin Asignado */}
            {sedeAdminInfo ? (
              <div className="bg-white/40 dark:bg-white/[0.03] border border-white/50 dark:border-white/[0.08] rounded-2xl p-4 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
                <div className="flex items-center gap-2 mb-3 relative z-10">
                  <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <h3 className="text-xs font-bold tracking-wider text-gray-800 dark:text-gray-200">
                    Administrador Asignado
                  </h3>
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <div 
                    className="w-10 h-10 rounded-xl overflow-hidden shadow-md shrink-0 relative cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomedImage(sedeAdminInfo.avatar_url || sedeAdminInfo.photo_url || '/favicon.png');
                    }}
                  >
                    <img 
                      src={sedeAdminInfo.avatar_url || sedeAdminInfo.photo_url || '/favicon.png'} 
                      alt={sedeAdminInfo.name || 'Admin'}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/favicon.png';
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{sedeAdminInfo.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sedeAdminInfo.email}</p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold tracking-wide mt-0.5">
                      {sedeAdminInfo.user_groups?.length || 0} Sede{(sedeAdminInfo.user_groups?.length || 0) !== 1 ? 's' : ''} bajo gestión
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/[0.03] border border-amber-500/10 rounded-2xl p-4 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold tracking-wider text-amber-600 dark:text-amber-400">Sin administrador</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No hay un administrador asignado formalmente a esta sede.</p>
                </div>
              </div>
            )}

            {/* Rooms de la Sede en cápsulas concéntricas */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Video className="w-[18px] h-[18px] text-fuchsia-500 dark:text-fuchsia-400 drop-shadow-[0_0_6px_rgba(236,72,153,0.4)] flex-shrink-0" />
                <h3 className="text-[12px] sm:text-[13px] font-bold tracking-wider text-gray-900 dark:text-gray-100">
                  Rooms Habilitados
                </h3>
              </div>
              
              {selectedSedeInfo.rooms && selectedSedeInfo.rooms.length > 0 ? (
                <div className="flex flex-wrap gap-2.5">
                  {selectedSedeInfo.rooms.map((room: any) => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomClick(room)}
                      className="inline-flex items-center px-[18px] py-1.5 bg-purple-500/[0.03] dark:bg-purple-950/[0.15] hover:bg-purple-500/[0.08] dark:hover:bg-purple-900/[0.25] border border-purple-500/10 dark:border-purple-500/20 hover:border-fuchsia-500/40 dark:hover:border-fuchsia-500/50 rounded-full text-xs font-medium tracking-wide text-gray-700 dark:text-purple-200 hover:text-fuchsia-600 dark:hover:text-fuchsia-300 active:scale-95 hover:scale-[1.02] transition-all shadow-[0_2px_8px_rgba(168,85,247,0.04)] hover:shadow-[0_0_12px_rgba(232,121,249,0.2)] gap-2.5 cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full bg-cyan-400 dark:bg-cyan-300 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
                      <span>{room.room_name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05] rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-sm font-bold text-gray-600 dark:text-gray-400">No hay rooms creados</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Utiliza la acción principal en la cabecera para agregar un room.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </>
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
                        <div key={room.id} className="inline-flex items-center group">
                          <button
                            onClick={() => handleRoomClick(room)}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer"
                          >
                            {room.room_name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('🔍 [DELETE-ROOM] Botón de eliminar clickeado (lista grupos):', room);
                              setRoomToDelete(room);
                              setShowDeleteRoomModal(true);
                            }}
                            className="ml-1 p-0.5 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            title="Eliminar room"
                          >
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        */}

        {/* Modal Crear Sede - Para Super Admin y Superadmin AFF */}
        {showCreateGroup && (userRole === 'super_admin' || userRole === 'superadmin_aff') && (
          <StandardModal
            isOpen={showCreateGroup}
            onClose={() => setShowCreateGroup(false)}
            title="Crear Nueva Sede"
            maxWidthClass="max-w-lg"
            paddingClass="p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
          >
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-slate-700 rounded-xl flex items-center justify-center shadow-md">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
              
            <form onSubmit={handleCreateGroup} className="space-y-5">
              {/* Mensajes de estado dentro del modal */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{success}</p>
                </div>
              )}
            
              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Nombre de la Sede
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="Ej: Sede Norte"
                  required
                />
              </div>

              {/* Botonera agrupada en píldora (Regla 16) */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroup(false);
                    setNewGroupName('');
                  }}
                  className="flex-1 h-9 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full active:scale-95 transition-all duration-200 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] text-xs disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear Sede'}
                </button>
              </div>
            </form>
          </StandardModal>
        )}

        {/* Modal Crear Room */}
        {showCreateRoom && (
          <StandardModal
            isOpen={showCreateRoom}
            onClose={() => setShowCreateRoom(false)}
            title="Crear Room"
            maxWidthClass="max-w-lg"
            paddingClass="p-7"
            headerMarginClass="mb-5"
            formSpaceYClass="space-y-5"
          >
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
              
            <form onSubmit={handleCreateRoom} className="space-y-5">
              {/* Mensajes de estado dentro del modal */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{success}</p>
                </div>
              )}
            
              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Sede Seleccionada
                </label>
                <div className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
                  {groups.find(g => g.id === selectedGroup)?.name || 'Ninguna sede seleccionada'}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-200 text-sm font-semibold mb-2">
                  Nombre del Room
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  placeholder="Ej: ROOM01"
                  required
                />
              </div>

              {/* Botonera agrupada en píldora (Regla 16) */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRoom(false);
                    setNewRoomName('');
                    setSelectedGroup('');
                  }}
                  className="flex-1 h-9 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full active:scale-95 transition-all duration-200 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedGroup}
                  className="flex-1 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] text-xs disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear Room'}
                </button>
              </div>
            </form>
          </StandardModal>
        )}

        {/* Modal Configuración de Room */}
        {showRoomConfig && selectedRoom && (
          <StandardModal
            isOpen={showRoomConfig}
            onClose={() => { setShowRoomConfig(false); setSelectedRoom(null); setRoomAssignments([]); }}
            title={`Configuración de ${selectedRoom.room_name}`}
            maxWidthClass="max-w-2xl"
            paddingClass="p-6"
            headerMarginClass="mb-4"
            formSpaceYClass="space-y-4"
          >
              {/* Mensajes de error y éxito del modal */}
              {roomConfigError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800 dark:text-red-400">{roomConfigError}</p>
                    </div>
                  </div>
                </div>
              )}

              {roomConfigSuccess && (
                <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-emerald-800 dark:text-emerald-400">{roomConfigSuccess}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Jornadas */}
              <div className="space-y-4">
                {['Mañana', 'Tarde', 'Noche'].map((jornada) => {
                  const assignmentsForJornada = roomAssignments.filter(
                    assignment => assignment.jornada === jornada.toUpperCase()
                  );
                  
                  return (
                    <div key={jornada} className="bg-white/40 dark:bg-white/[0.03] border border-white/50 dark:border-white/[0.08] rounded-2xl p-4 relative overflow-hidden">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        {jornada}
                      </h3>
                      
                      {assignmentsForJornada.length > 0 ? (
                        <div className="space-y-2">
                          {assignmentsForJornada.map((assignment) => (
                            <div key={assignment.id} className="flex items-center justify-between bg-white/20 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04] rounded-xl p-3 hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all duration-200 relative">
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex-shrink-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomedImage(assignment.model_avatar || '/favicon.png');
                                  }}
                                >
                                  <img 
                                    src={assignment.model_avatar || '/favicon.png'} 
                                    alt={assignment.model_name || 'Modelo'}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '/favicon.png';
                                    }}
                                  />
                                </div>
                                <div 
                                  className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg p-2 -m-2 transition-colors group min-w-0"
                                  onClick={() => handleModelClick(assignment.model_id, assignment.model_email)}
                                  title="Ver portafolio de la modelo"
                                >
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors truncate">
                                    {getModelDisplayName(assignment.model_email) || assignment.model_name || 'Modelo no especificada'}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                    {assignment.model_email || 'Email no disponible'}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Punto indicador azul (Asignada) con margen para la X absoluta */}
                              <div className="flex items-center shrink-0 mr-6">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" title="Asignada"></div>
                              </div>
                              
                              {/* Botón X absoluto en la esquina superior derecha */}
                              <button
                                onClick={() => confirmDeleteAssignment(assignment)}
                                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 active:scale-90 transition-all cursor-pointer"
                                title="Eliminar modelo de esta jornada"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between bg-white/20 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04] rounded-xl p-3 cursor-pointer hover:bg-white/40 dark:hover:bg-white/[0.05] active:scale-[0.99] transition-all duration-200"
                          onClick={() => handleJornadaClick(jornada.toUpperCase())}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-500 rounded-full flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-gray-400 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No hay modelos asignadas</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">Haz clic para asignar</p>
                            </div>
                          </div>
                          
                          {/* Punto indicador verde (Disponible) */}
                          <div className="flex items-center shrink-0 mr-6">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" title="Disponible"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Botonera agrupada en píldora translúcida (Regla 16) */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-6">
                <button
                  onClick={() => {
                    setShowRoomConfig(false);
                    setSelectedRoom(null);
                    setRoomAssignments([]);
                  }}
                  className="flex-1 h-9 bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] text-xs"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    setRoomToDelete(selectedRoom);
                    setShowDeleteRoomModal(true);
                  }}
                  className="flex-1 h-9 bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full active:scale-95 transition-all duration-200 text-xs font-semibold"
                >
                  Eliminar Room
                </button>
              </div>
          </StandardModal>
        )}

        {/* Modal Selector de Modelos */}
        {showModelSelector && (
          <StandardModal
            isOpen={showModelSelector}
            onClose={() => { setShowModelSelector(false); setAvailableModels([]); setSelectedJornada(''); }}
            title={`Seleccionar Modelo para ${selectedJornada}`}
            maxWidthClass="max-w-md"
            paddingClass="p-6"
            headerMarginClass="mb-4"
            formSpaceYClass="space-y-4"
          >
              
              <div className="space-y-2">
                {availableModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model)}
                    className="w-full text-left p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {model.name || 'Nombre no disponible'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {model.email || 'Email no disponible'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {availableModels.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No hay modelos disponibles</p>
                </div>
              )}
          </StandardModal>
        )}

        {/* Modal de Confirmación de Conflicto */}
        {showConflictModal && conflictInfo && (
          <StandardModal
            isOpen={showConflictModal}
            onClose={() => { setShowConflictModal(false); setConflictInfo(null); setSelectedModel(null); }}
            title="Conflicto de Asignación"
            maxWidthClass="max-w-md"
            paddingClass="p-6"
            headerMarginClass="mb-4"
            formSpaceYClass="space-y-4"
          >
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  <strong>{conflictInfo.model.name}</strong> ya está asignada en:
                </p>
                
                <div className="space-y-2">
                  {conflictInfo.existingAssignments.map((assignment: any, index: number) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {assignment.room_name} - {assignment.jornada}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">
                  ¿Qué deseas hacer?
                </p>
              </div>
              
              {/* Botonera agrupada en píldora (Regla 16) */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-5">
                <button
                  onClick={() => assignModel(conflictInfo.model, 'move')}
                  className="flex-1 h-9 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-[0_0_15px_rgba(249,115,22,0.3)] text-xs"
                >
                  Mover
                </button>
                <button
                  onClick={() => assignModel(conflictInfo.model, 'assign')}
                  className="flex-1 h-9 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-[0_0_15px_rgba(59,130,246,0.3)] text-xs"
                >
                  Doblar
                </button>
              </div>
              
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p><strong>Mover:</strong> Desasigna de ubicación actual y asigna aquí</p>
                <p><strong>Doblar:</strong> Mantiene ubicación actual y asigna también aquí</p>
              </div>
          </StandardModal>
        )}

        {/* Modal de Confirmación de Eliminación */}
        {showDeleteConfirm && assignmentToDelete && (
          <StandardModal
            isOpen={showDeleteConfirm}
            onClose={() => { setShowDeleteConfirm(false); setAssignmentToDelete(null); }}
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)] flex-shrink-0" />
                <span className="text-gray-900 dark:text-gray-100">Confirmar Eliminación</span>
              </span>
            }
            maxWidthClass="max-w-md"
            paddingClass="p-8"
            headerMarginClass="mb-6"
            formSpaceYClass="space-y-6"
          >
                <div className="mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    ¿Estás seguro de que deseas eliminar a <strong>{assignmentToDelete.model_name}</strong> de la jornada <strong>{assignmentToDelete.jornada.charAt(0) + assignmentToDelete.jornada.slice(1).toLowerCase()}</strong>?
                  </p>
                  <div className="bg-white/20 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04] rounded-2xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{assignmentToDelete.model_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{assignmentToDelete.model_email}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botonera agrupada en píldora (Regla 16) */}
                <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-5">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setAssignmentToDelete(null);
                    }}
                    className="flex-1 h-9 bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={deleteModelAssignment}
                    disabled={assignmentToDelete?.isDeleting}
                    className={`flex-1 h-9 rounded-full transition-all duration-200 font-bold text-xs ${
                      assignmentToDelete?.isDeleting
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 active:scale-95'
                    }`}
                  >
                    {assignmentToDelete?.isDeleting ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
          </StandardModal>
        )}

        {/* Modal de Confirmación de Eliminación de Room */}
        {showDeleteRoomModal && roomToDelete && (
          <StandardModal
            isOpen={showDeleteRoomModal}
            onClose={() => { setShowDeleteRoomModal(false); setRoomToDelete(null); }}
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)] flex-shrink-0" />
                <span className="text-gray-900 dark:text-gray-100">Confirmar Eliminación de Room</span>
              </span>
            }
            maxWidthClass="max-w-md"
            paddingClass="p-8"
            headerMarginClass="mb-6"
            formSpaceYClass="space-y-6"
          >
                <div className="mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    ¿Estás seguro de que deseas eliminar el room <strong>{roomToDelete.room_name}</strong>?
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 drop-shadow-[0_0_4px_rgba(234,179,8,0.3)] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Advertencia</p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Esta acción no se puede deshacer. Si el room tiene asignaciones activas, no se podrá eliminar.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Botonera agrupada en píldora (Regla 16) */}
                <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-6">
                  <button
                    onClick={() => {
                      console.log('🔍 [DELETE-ROOM] Cancelando eliminación');
                      setShowDeleteRoomModal(false);
                      setRoomToDelete(null);
                    }}
                    className="flex-1 h-9 bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      console.log('🔍 [DELETE-ROOM] Confirmando eliminación de:', roomToDelete);
                      handleDeleteRoom();
                    }}
                    disabled={submitting}
                    className="flex-1 h-9 bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full active:scale-95 transition-all duration-200 text-xs font-semibold disabled:opacity-50"
                  >
                    {submitting ? 'Eliminando...' : 'Eliminar Room'}
                  </button>
                </div>
          </StandardModal>
        )}

        {/* Modal para editar sede */}
        {showEditSedeModal && sedeToEdit && (
          <StandardModal
            isOpen={showEditSedeModal}
            onClose={() => {
              setShowEditSedeModal(false);
              setSedeToEdit(null);
              setEditSedeName('');
              setEditSedeDescription('');
            }}
            title="Editar Sede"
            maxWidthClass="max-w-md"
          >
            <form onSubmit={handleEditSede} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Nombre de la Sede *
                </label>
                <input
                  type="text"
                  value={editSedeName}
                  onChange={(e) => setEditSedeName(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200"
                  required
                  placeholder="Nombre de la sede"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={editSedeDescription}
                  onChange={(e) => setEditSedeDescription(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all duration-200 resize-none"
                  rows={3}
                  placeholder="Descripción de la sede (opcional)"
                />
              </div>

              <div className="flex items-center space-x-3 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editSedeActive}
                    onChange={(e) => setEditSedeActive(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Sede activa</span>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Botonera agrupada en píldora (Regla 16) */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-6">
                <button
                  type="submit"
                  disabled={submitting || !editSedeName.trim()}
                  className="flex-1 h-9 bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] text-xs disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSedeModal(false);
                    setSedeToEdit(null);
                    setEditSedeName('');
                    setEditSedeDescription('');
                    setError('');
                  }}
                  className="flex-1 h-9 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-full active:scale-95 transition-all duration-200 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </StandardModal>
        )}

        {/* Modal para eliminar sede */}
        {showDeleteSedeModal && sedeToDelete && (
          <StandardModal
            isOpen={showDeleteSedeModal}
            onClose={() => {
              setShowDeleteSedeModal(false);
              setSedeToDelete(null);
            }}
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)] flex-shrink-0" />
                <span className="text-gray-900 dark:text-gray-100">Confirmar Eliminación de Sede</span>
              </span>
            }
            maxWidthClass="max-w-md"
          >
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                      ¿Estás seguro de eliminar esta sede?
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Esta acción no se puede deshacer. La sede <strong>{sedeToDelete.name}</strong> será eliminada permanentemente.
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-2 font-medium">
                      ⚠️ Si la sede tiene usuarios o rooms asignados, no se podrá eliminar.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Botonera agrupada en píldora (Regla 16) */}
              <div className="flex items-center gap-1.5 p-1.5 bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] rounded-[2rem] backdrop-blur-xl shadow-sm w-full mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteSedeModal(false);
                    setSedeToDelete(null);
                    setError('');
                  }}
                  className="flex-1 h-9 bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white rounded-full active:scale-95 transition-all duration-200 font-bold shadow-md shadow-cyan-500/30 dark:shadow-[0_0_15px_rgba(34,211,238,0.5)] text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSede}
                  disabled={submitting}
                  className="flex-1 h-9 bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full active:scale-95 transition-all duration-200 text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Eliminando...' : 'Eliminar Sede'}
                </button>
              </div>
            </div>
          </StandardModal>
        )}
        {/* Zoomed Image Modal */}
        {zoomedImage && isMounted && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 cursor-pointer animate-in fade-in duration-200"
            onClick={() => setZoomedImage(null)}
            style={{ zIndex: 100000 }}
          >
            <img 
              src={zoomedImage} 
              alt="Avatar Ampliado" 
              className="w-full max-w-[360px] h-auto max-h-[360px] rounded-2xl shadow-2xl object-cover border border-white/10 cursor-default animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-md transition-colors cursor-pointer"
              onClick={() => setZoomedImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
