'use client';

import { useState, useEffect } from 'react';
import { User, Building2, Grid3X3, Filter, Eye, AlertCircle, CheckCircle, Clock, XCircle, Minus, AlertTriangle } from 'lucide-react';
import AppleSelect from '@/components/AppleSelect';

interface ModeloPlatform {
  id: string | null;
  model_id: string;
  model_name: string;
  model_email: string;
  platform_id: string;
  platform_name: string;
  platform_code: string;
  status: 'disponible' | 'solicitada' | 'pendiente' | 'entregada' | 'desactivada' | 'inviable';
  requested_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  deactivated_at: string | null;
  reverted_at: string | null;
  requested_by_name: string | null;
  delivered_by_name: string | null;
  confirmed_by_name: string | null;
  deactivated_by_name: string | null;
  reverted_by_name: string | null;
  notes: string | null;
  revert_reason: string | null;
  is_initial_config: boolean;
  calculator_sync: boolean;
  calculator_activated_at: string | null;
  group_name: string;
  group_id: string;
  created_at: string | null;
  updated_at: string | null;
}

interface Model {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  group_id: string;
}

interface Platform {
  id: string;
  name: string;
}

export default function PortafolioModelos() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de datos
  const [platforms, setPlatforms] = useState<ModeloPlatform[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([]);
  
  // Estados de filtros
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedJornada, setSelectedJornada] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  
  // Estados de UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedPlatformForAction, setSelectedPlatformForAction] = useState<ModeloPlatform | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'request' | 'deliver' | 'deactivate' | 'revert'>('request');
  const [actionNotes, setActionNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  // Información del usuario
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');

  const jornadas = ['MAÑANA', 'TARDE', 'NOCHE'];

  // Cargar información del usuario
  useEffect(() => {
    const loadUserInfo = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserRole(user.role || '');
        setUserId(user.id || '');
      }
    };

    loadUserInfo();
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Cargar plataformas cuando cambien los filtros
  useEffect(() => {
    if (!loading) {
      const hasAnyFilter = !!(selectedGroup || selectedModel || selectedRoom || selectedJornada || selectedPlatform);
      if (hasAnyFilter) {
        loadPlatforms();
      } else {
        setPlatforms([]);
      }
    }
  }, [selectedModel, selectedGroup, selectedRoom, selectedJornada, selectedPlatform]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Cargar grupos
      const groupsResponse = await fetch('/api/groups');
      if (groupsResponse.ok) {
        const groupsRaw = await groupsResponse.json();
        const list = Array.isArray(groupsRaw)
          ? groupsRaw
          : (Array.isArray(groupsRaw?.groups) ? groupsRaw.groups : []);
        const clean = list.filter((g: any) => g.name !== 'Otros' && g.name !== 'Satélites');
        setGroups(clean);
      }

      // Cargar catálogo de plataformas
      const platformsResponse = await fetch('/api/plataformas-catalogo');
      if (platformsResponse.ok) {
        const platformsData = await platformsResponse.json();
        setAllPlatforms(Array.isArray(platformsData) ? platformsData : []);
      }

      // Cargar IDs de usuarios con rol 'modelo' para filtrar panel
      const usersRes = await fetch('/api/users?role=modelo');
      if (usersRes.ok) {
        const raw = await usersRes.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.users) ? raw.users : []);
        setAllowedModelIds(list.map((u: any) => u.id));
      }

      // No cargar plataformas inicialmente; esperar a que se apliquen filtros
      
    } catch (error) {
      console.error('Error loading initial data:', error);
      setError('Error al cargar los datos iniciales');
    } finally {
      setLoading(false);
    }
  };

  const loadPlatforms = async () => {
    try {
      // Si hay un grupo seleccionado, cargar modelos/rooms de ese grupo
      if (selectedGroup) {
        await Promise.all([
          loadModelsForGroup(selectedGroup),
          loadRoomsForGroup(selectedGroup)
        ]);
      }

      const params = new URLSearchParams();
      if (selectedModel) params.append('model_id', selectedModel);
      if (selectedGroup) params.append('group_id', selectedGroup);
      if (selectedRoom) params.append('room_id', selectedRoom);
      if (selectedJornada) params.append('jornada', selectedJornada);
      if (selectedPlatform) params.append('platform_id', selectedPlatform);

      const response = await fetch(`/api/modelo-plataformas?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        // Filtrar solo modelos reales (role = 'modelo'), no admin ni super_admin
        const filteredData = Array.isArray(data) ? data.filter(platform => {
          // Filtrar por nombres que no sean administradores
          return platform.model_name && 
                 !platform.model_name.includes('Administrator') &&
                 !platform.model_name.includes('Super Administrator');
        }) : [];
        setPlatforms(filteredData);
      } else {
        setError('Error al cargar las plataformas');
      }
    } catch (error) {
      console.error('Error loading platforms:', error);
      setError('Error al cargar las plataformas');
    }
  };

  const loadModelsForGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/models`);
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.models) ? raw.models : []);
        setModels(list);
      }
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadRoomsForGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups/rooms?group_id=${groupId}`);
      if (response.ok) {
        const raw = await response.json();
        const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.rooms) ? raw.rooms : []);
        setRooms(list);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedModel('');
    setSelectedRoom('');
    setModels([]);
    setRooms([]);
    
    if (groupId) {
      loadModelsForGroup(groupId);
      loadRoomsForGroup(groupId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponible': return 'bg-white border-gray-200 text-gray-700';
      case 'solicitada': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'pendiente': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'entregada': return 'bg-green-50 border-green-200 text-green-700';
      case 'desactivada': return 'bg-gray-800 border-gray-700 text-white';
      case 'inviable': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'disponible': return <Eye className="w-4 h-4" />;
      case 'solicitada': return <Clock className="w-4 h-4" />;
      case 'pendiente': return <AlertCircle className="w-4 h-4" />;
      case 'entregada': return <CheckCircle className="w-4 h-4" />;
      case 'desactivada': return <Minus className="w-4 h-4" />;
      case 'inviable': return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'disponible': return 'Disponible';
      case 'solicitada': return 'Solicitada';
      case 'pendiente': return 'Pendiente';
      case 'entregada': return 'Entregada';
      case 'desactivada': return 'Desactivada';
      case 'inviable': return 'Inviable';
      default: return 'Desconocido';
    }
  };

  const handlePlatformAction = (platform: ModeloPlatform, action: string) => {
    setSelectedPlatformForAction(platform);
    setActionType(action as any);
    setActionNotes('');
    setShowActionModal(true);
  };

  const executeAction = async () => {
    if (!selectedPlatformForAction || !userId) return;

    try {
      setProcessingAction(true);
      setError('');

      let newStatus = '';
      switch (actionType) {
        case 'request': newStatus = 'solicitada'; break;
        case 'deliver': newStatus = 'entregada'; break;
        case 'deactivate': newStatus = 'desactivada'; break;
        case 'revert': newStatus = 'disponible'; break;
      }

      const response = await fetch('/api/modelo-plataformas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: selectedPlatformForAction.model_id,
          platform_id: selectedPlatformForAction.platform_id,
          new_status: newStatus,
          changed_by: userId,
          reason: actionNotes || null
        })
      });

      if (response.ok) {
        setSuccess(`Plataforma ${getStatusText(newStatus).toLowerCase()} correctamente`);
        setShowActionModal(false);
        await loadPlatforms();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Error al procesar la acción');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setError('Error al procesar la acción');
    } finally {
      setProcessingAction(false);
    }
  };

  // Filtrar para mostrar únicamente usuarios con rol 'modelo'
  const filteredPlatforms = platforms.filter(p =>
    allowedModelIds.length === 0 ? true : allowedModelIds.includes(p.model_id)
  );

  // Agrupar plataformas por modelo
  const modelGroups = filteredPlatforms.reduce((acc, platform) => {
    const modelKey = platform.model_id;
    if (!acc[modelKey]) {
      acc[modelKey] = {
        model_id: platform.model_id,
        model_name: platform.model_name,
        model_email: platform.model_email,
        group_name: platform.group_name,
        group_id: platform.group_id,
        platforms: []
      };
    }
    acc[modelKey].platforms.push(platform);
    return acc;
  }, {} as Record<string, {
    model_id: string;
    model_name: string;
    model_email: string;
    group_name: string;
    group_id: string;
    platforms: ModeloPlatform[];
  }>);

  const modelsList = Object.values(modelGroups);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Cargando portafolio...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-white/20 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center shadow-md border border-white/20">
                <Grid3X3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portafolio Modelos</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Gestión de plataformas por modelo y sede
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 px-4 py-3 rounded-lg shadow-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50/80 backdrop-blur-sm border border-green-200/50 text-green-700 px-4 py-3 rounded-lg shadow-sm">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="mb-8">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filtros
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                {showFilters ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <AppleSelect
                  label="Grupo"
                  value={selectedGroup}
                  options={[{ label: 'Todos los grupos', value: '' }, ...groups.map(g => ({ label: g.name, value: g.id }))]}
                  onChange={(val) => handleGroupChange(val)}
                />
                <AppleSelect
                  label="Modelo"
                  value={selectedModel}
                  options={[{ label: 'Todas las modelos', value: '' }, ...models.map(m => ({ label: m.name, value: m.id }))]}
                  onChange={(val) => setSelectedModel(val)}
                />
                <AppleSelect
                  label="Room"
                  value={selectedRoom}
                  options={[{ label: 'Todos los rooms', value: '' }, ...rooms.map(r => ({ label: r.name, value: r.id }))]}
                  onChange={(val) => setSelectedRoom(val)}
                />
                <AppleSelect
                  label="Jornada"
                  value={selectedJornada}
                  options={[{ label: 'Todas las jornadas', value: '' }, ...jornadas.map(j => ({ label: j, value: j }))]}
                  onChange={(val) => setSelectedJornada(val)}
                />
                <AppleSelect
                  label="Plataforma"
                  value={selectedPlatform}
                  options={[{ label: 'Todas las plataformas', value: '' }, ...allPlatforms.map(p => ({ label: p.name, value: p.id }))]}
                  onChange={(val) => setSelectedPlatform(val)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-md border border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Modelos ({modelsList.length})
            </h3>
          </div>

          {modelsList.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aplica un filtro de Grupo, Modelo, Room, Jornada o Plataforma para ver resultados.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {modelsList.map((model) => (
                <div
                  key={model.model_id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg p-6"
                >
                  {/* Header del Modelo */}
                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{model.model_name}</h4>
                      <p className="text-sm text-gray-600 flex items-center">
                        <Building2 className="w-4 h-4 mr-1" />
                        {model.group_name}
                      </p>
                    </div>
                  </div>

                  {/* Grid de Plataformas */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {model.platforms.map((platform) => (
                      <div
                        key={`${platform.model_id}-${platform.platform_id}`}
                        className={`${getStatusColor(platform.status)} border rounded-lg p-3 text-center hover:shadow-md transition-all duration-200 cursor-pointer`}
                        onClick={() => handlePlatformAction(platform, 'request')}
                      >
                        <div className="flex flex-col items-center space-y-2">
                          {getStatusIcon(platform.status)}
                          <span className="text-xs font-medium truncate w-full">
                            {platform.platform_name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Estadísticas del Modelo */}
                  <div className="mt-4 pt-4 border-t border-gray-200/50">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Total: {model.platforms.length} plataformas</span>
                      <div className="flex space-x-4">
                        <span className="text-green-600">
                          Entregadas: {model.platforms.filter(p => p.status === 'entregada').length}
                        </span>
                        <span className="text-blue-600">
                          Solicitadas: {model.platforms.filter(p => p.status === 'solicitada').length}
                        </span>
                        <span className="text-gray-500">
                          Disponibles: {model.platforms.filter(p => p.status === 'disponible').length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Modal */}
        {showActionModal && selectedPlatformForAction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-white/20">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {actionType === 'request' && 'Solicitar Plataforma'}
                {actionType === 'deliver' && 'Entregar Plataforma'}
                {actionType === 'deactivate' && 'Desactivar Plataforma'}
                {actionType === 'revert' && 'Revertir Plataforma'}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Plataforma:</strong> {selectedPlatformForAction.platform_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Modelo:</strong> {selectedPlatformForAction.model_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Estado actual:</strong> {getStatusText(selectedPlatformForAction.status)}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Agregar notas sobre esta acción..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={processingAction}
                >
                  Cancelar
                </button>
                <button
                  onClick={executeAction}
                  disabled={processingAction}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {processingAction ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}