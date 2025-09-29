"use client";
import { useEffect, useState } from "react";
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
        />
        <input 
          placeholder="Email" 
          type="email" 
          value={form.email} 
          onChange={e=>setForm({...form, email:e.target.value})} 
          required 
        />
        <input 
          placeholder="Contraseña" 
          type="password" 
          value={form.password} 
          onChange={e=>setForm({...form, password:e.target.value})} 
          required 
        />
        <select 
          value={form.role} 
          onChange={e=>setForm({...form, role:e.target.value})}
        >
          <option value="modelo">modelo</option>
          <option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>
        <div>
          <div style={{ marginBottom: 6, color: '#111827', fontSize: 14, fontWeight: 500 }}>Grupos</div>
          <div style={{
            maxHeight: 180,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 12,
            background: '#f9fafb'
          }}>
            {loadingGroups ? (
              <div style={{ color: '#6b7280', fontSize: 14 }}>Cargando grupos…</div>
            ) : (
              groups.map(g => {
                const isChecked = form.groups.includes(g.id);
                const isDisabled = form.role === 'modelo' && form.groups.length > 0 && !isChecked;
                return (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, cursor: isDisabled ? 'not-allowed' : 'pointer', background: isDisabled ? '#f3f4f6' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, groups: [...form.groups, g.id] });
                        } else {
                          setForm({ ...form, groups: form.groups.filter(id => id !== g.id) });
                        }
                      }}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ color: isDisabled ? '#9ca3af' : '#374151', fontSize: 14, fontWeight: 500 }}>
                      {g.name}
                      {isDisabled && <span style={{ marginLeft: 6, fontSize: 12, color: '#9ca3af' }}>(deshabilitado)</span>}
                    </span>
                  </label>
                );
              })
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