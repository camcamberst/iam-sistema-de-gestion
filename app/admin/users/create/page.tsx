"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    password: "", 
    role: "modelo", 
    groups: [] as string[] 
  });
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<Array<{id:string; name:string}>>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [openGroups, setOpenGroups] = useState(false);
  const [openRole, setOpenRole] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);

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

  // Cerrar dropdown de Rol al hacer clic fuera o con Escape
  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (!openRole) return;
      const target = ev.target as Node;
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(target)) {
        setOpenRole(false);
      }
    }
    function handleKey(ev: KeyboardEvent) {
      if (openRole && ev.key === 'Escape') setOpenRole(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openRole]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify(form) 
      });
      if (res.ok) router.push("/admin/users");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Crear Usuario</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={e=>setForm({...form, name:e.target.value})}
          required
          style={{
            width:'100%',
            border:'1px solid #d1d5db',
            borderRadius:12,
            padding:'10px 12px',
            color:'#111827'
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
            border:'1px solid #d1d5db',
            borderRadius:12,
            padding:'10px 12px',
            color:'#111827'
          }}
        />
        <input
          placeholder="Contraseña"
          type="password"
          value={form.password}
          onChange={e=>setForm({...form, password:e.target.value})}
          required
          style={{
            width:'100%',
            border:'1px solid #d1d5db',
            borderRadius:12,
            padding:'10px 12px',
            color:'#111827'
          }}
        />
        {/* Rol - Dropdown Apple-like */}
        <div ref={roleDropdownRef}>
          <div style={{ marginBottom: 6, color: '#111827', fontSize: 14, fontWeight: 500 }}>Rol</div>
          <div style={{ position:'relative' }}>
            <button
              type="button"
              onClick={()=> setOpenRole(v=>!v)}
              style={{
                width:'100%', textAlign:'left', border:'1px solid #d1d5db', borderRadius:12,
                padding:'10px 12px', background:'#ffffff', color:'#111827', display:'flex', alignItems:'center', justifyContent:'space-between'
              }}
            >
              <span style={{ textTransform:'capitalize' }}>{form.role.replace('_',' ')}</span>
              <span>▾</span>
            </button>
            {openRole && (
              <div className="apple-scroll" style={{
                position:'absolute', zIndex:50, width:'100%', marginTop:6, background:'#ffffff',
                border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 10px 25px rgba(0,0,0,0.08)'
              }}>
                {['modelo','admin','super_admin'].map(r => (
                  <button key={r} type="button"
                    onClick={()=> { setForm({ ...form, role:r as any }); setOpenRole(false); }}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:10, background: form.role===r? '#f3f4f6':'#ffffff', border:'none', cursor:'pointer' }}
                  >{r.replace('_',' ')}</button>
                ))}
              </div>
            )}
          </div>
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
        <button disabled={submitting} type="submit">
          {submitting? "Creando...":"Crear"}
        </button>
      </form>
    </div>
  );
}