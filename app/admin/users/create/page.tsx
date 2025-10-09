"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppleDropdown from '@/components/ui/AppleDropdown';

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    role: "modelo", 
    groups: [] as string[],
    room_id: "",
    jornada: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<{id:string; name:string}>>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [openGroups, setOpenGroups] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Array<{id: string, room_name: string}>>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Función para determinar si un grupo requiere rooms obligatorios
  const groupRequiresRooms = (groupName: string): boolean => {
    // Solo "Sede MP" requiere rooms obligatorios
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Función para determinar si un grupo requiere jornada obligatoria
  const groupRequiresJornada = (groupName: string): boolean => {
    // Solo "Sede MP" requiere jornada obligatoria
    // Otros grupos (Cabecera, Victoria, Terrazas, Diamante) omitidos por ahora
    return groupName === 'Sede MP';
  };

  // Obtener el nombre del grupo seleccionado
  const selectedGroupName = groups.find(g => g.id === form.groups[0])?.name || '';

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const res = await fetch('/api/groups');
        const data = await res.json();
        if (data.success) setGroups(data.groups);
      } finally {
        setLoadingGroups(false);
      }
    };
    loadGroups();
  }, []);

  // Función para cargar rooms por grupo
  const loadRoomsForGroup = async (groupId: string) => {
    if (!groupId) {
      setAvailableRooms([]);
      return;
    }

    setLoadingRooms(true);
    try {
      const response = await fetch(`/api/groups/rooms?groupId=${groupId}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableRooms(data.rooms);
      } else {
        console.error('Error loading rooms:', data.error);
        setAvailableRooms([]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Cargar rooms cuando se selecciona un grupo
  useEffect(() => {
    if (form.groups.length > 0) {
      loadRoomsForGroup(form.groups[0]);
    } else {
      setAvailableRooms([]);
    }
  }, [form.groups]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Preparar datos para la API - cambiar 'groups' por 'group_ids'
      const apiData = {
        ...form,
        group_ids: form.groups, // Mapear groups a group_ids
        groups: undefined // Eliminar el campo groups
      };
      delete apiData.groups; // Limpiar el campo groups
      
      console.log('🔍 [FRONTEND] Enviando datos a la API:', apiData);
      
      const res = await fetch("/api/users", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(apiData) 
      });
      
      const result = await res.json();
      console.log('🔍 [FRONTEND] Respuesta de la API:', result);
      
      if (res.ok && result.success) {
        setSuccess('Usuario creado exitosamente');
        // Limpiar formulario
        setForm({
          name: "",
          email: "",
          password: "",
          role: "modelo",
          groups: [],
          room_id: "",
          jornada: ""
        });
        // Redirigir después de 2 segundos
        setTimeout(() => {
          router.push("/admin/users");
        }, 2000);
      } else {
        setError(result.error || 'Error creando usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-start justify-center p-4 pt-24">
      <div className="w-full max-w-md">
        <div className="relative bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Crear Usuario</h1>
          </div>
        
        {/* Mensajes de error y éxito */}
        {error && (
          <div className="mb-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-4 h-4 bg-red-500 rounded-sm flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50/80 backdrop-blur-sm border border-green-200/50 rounded-lg shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-4 h-4 bg-green-500 rounded-sm flex items-center justify-center">
                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <input
          placeholder="Nombre"
          value={form.name}
          onChange={e=>setForm({...form, name:e.target.value})}
          required
          style={{
            width:'100%',
            border:'1px solid #e5e7eb',
            borderRadius:12,
            padding:'12px 14px',
            color:'#111827',
            background:'#fafafa'
          }}
          />
          <input
          placeholder="Correo electrónico"
          type="email"
          value={form.email}
          onChange={e=>setForm({...form, email:e.target.value})}
          required
          style={{
            width:'100%',
            border:'1px solid #e5e7eb',
            borderRadius:12,
            padding:'12px 14px',
            color:'#111827',
            background:'#fafafa'
          }}
          />
          {/* Password with show/hide */}
          <div style={{ position:'relative' }}>
            <input
              placeholder="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e=>setForm({...form, password:e.target.value})}
              required
              style={{
                width:'100%',
                border:'1px solid #e5e7eb',
                borderRadius:12,
                padding:'12px 44px 12px 14px',
                color:'#111827',
                background:'#fafafa'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v=>!v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              style={{
                position:'absolute', right:8, top:8,
                borderRadius:10, padding:'6px 10px',
                background:'#111827', color:'#fff', fontSize:12
              }}
            >
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        {/* Rol - AppleDropdown */}
        <div>
          <label className="block text-gray-700 text-sm font-medium mb-2">Rol</label>
          <AppleDropdown
            options={[
              { value: 'modelo', label: 'Modelo' },
              { value: 'admin', label: 'Admin' },
              { value: 'super_admin', label: 'Super Admin' }
            ]}
            value={form.role}
            onChange={(value) => setForm({ ...form, role: value as any })}
            placeholder="Selecciona un rol"
          />
        </div>
        <div>
          <div style={{ marginBottom: 6, color: '#111827', fontSize: 14, fontWeight: 500 }}>Grupos</div>
          {/* Dropdown de grupos */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenGroups(v => !v)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '10px 12px',
                background: '#ffffff',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ color: form.groups.length ? '#111827' : '#9ca3af' }}>
                {form.groups.length
                  ? groups.filter(g => form.groups.includes(g.id)).map(g => g.name).join(', ')
                  : (form.role === 'modelo' ? 'Selecciona un grupo' : 'Selecciona uno o varios grupos')}
              </span>
              <span>▾</span>
            </button>

            {openGroups && (
              <div
                className="apple-scroll"
                style={{
                  position: 'absolute',
                  zIndex: 50,
                  width: '100%',
                  marginTop: 6,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                  maxHeight: 220,
                  overflowY: 'auto'
                }}
              >
                {loadingGroups ? (
                  <div style={{ padding: 12, color: '#6b7280', fontSize: 14 }}>Cargando grupos…</div>
                ) : (
                  groups.map(g => {
                    const isSelected = form.groups.includes(g.id);
                    const isSingleRole = form.role === 'modelo';
                    const isDisabled = isSingleRole && form.groups.length > 0 && !isSelected;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isSingleRole) {
                            setForm({ ...form, groups: isSelected ? [] : [g.id] });
                            setOpenGroups(false);
                          } else {
                            setForm({
                              ...form,
                              groups: isSelected
                                ? form.groups.filter(id => id !== g.id)
                                : [...form.groups, g.id]
                            });
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: 8,
                          background: '#ffffff',
                          color: isDisabled ? '#9ca3af' : '#374151',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6'
                        }}
                      >
                        {/* Apple Switch */}
                        <span
                          aria-hidden
                          style={{
                            position: 'relative',
                            width: 34,
                            height: 20,
                            borderRadius: 9999,
                            background: isSelected ? '#111827' : '#e5e7eb',
                            transition: 'background 180ms ease',
                            flex: '0 0 auto'
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: isSelected ? 16 : 2,
                              width: 16,
                              height: 16,
                              borderRadius: '9999px',
                              background: '#ffffff',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              transition: 'left 180ms ease'
                            }}
                          />
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{g.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Campos adicionales para modelos */}
        {form.role === 'modelo' && (
          <>
            {/* Campo Room - solo obligatorio para Sede MP */}
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Room {groupRequiresRooms(selectedGroupName) && <span className="text-red-500">*</span>}
              </label>
              <AppleDropdown
                options={availableRooms.map(room => ({
                  value: room.id,
                  label: room.room_name
                }))}
                value={form.room_id}
                onChange={(value) => setForm({ ...form, room_id: value })}
                placeholder={loadingRooms ? "Cargando rooms..." : "Selecciona un room"}
                disabled={loadingRooms || availableRooms.length === 0}
                maxHeight="max-h-40"
              />
              {form.groups.length === 0 && (
                <p className="mt-1 text-sm text-gray-500">Primero selecciona un grupo</p>
              )}
              {!groupRequiresRooms(selectedGroupName) && selectedGroupName && (
                <p className="mt-1 text-sm text-gray-500">Opcional para {selectedGroupName}</p>
              )}
            </div>

            {/* Campo Jornada - solo obligatorio para Sede MP */}
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Jornada {groupRequiresJornada(selectedGroupName) && <span className="text-red-500">*</span>}
              </label>
              <AppleDropdown
                options={[
                  { value: 'MAÑANA', label: 'Mañana' },
                  { value: 'TARDE', label: 'Tarde' },
                  { value: 'NOCHE', label: 'Noche' }
                ]}
                value={form.jornada}
                onChange={(value) => setForm({ ...form, jornada: value })}
                placeholder="Selecciona una jornada"
              />
              {!groupRequiresJornada(selectedGroupName) && selectedGroupName && (
                <p className="mt-1 text-sm text-gray-500">Opcional para {selectedGroupName}</p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <button 
            disabled={submitting} 
            type="submit"
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting ? "Creando..." : "Crear Usuario"}
          </button>
          <button 
            type="button"
            onClick={() => router.back()}
            className="px-4 py-3 bg-white/80 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white/90 transition-all duration-300 font-medium border border-gray-200/50 shadow-sm hover:shadow-md"
          >
            Volver
          </button>
        </div>
        </form>
        </div>
      </div>
    </div>
  );
}