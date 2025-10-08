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
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4" style={{ paddingTop: '12vh' }}>
      <div className="w-full max-w-md">
        <div className="apple-card" style={{ padding: 24 }}>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Crear Usuario</h1>
        
        {/* Mensajes de error y éxito */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
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
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
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

        <button disabled={submitting} type="submit">
          {submitting? "Creando...":"Crear"}
        </button>
        </form>
        </div>
      </div>
    </div>
  );
}