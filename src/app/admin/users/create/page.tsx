"use client";
import { useState } from "react";
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
        <input 
          placeholder="Grupo (exacto)" 
          onChange={e=>setForm({...form, groups: e.target.value? [e.target.value]: []})} 
        />
        <button disabled={submitting} type="submit">
          {submitting? "Creando...":"Crear"}
        </button>
      </form>
    </div>
  );
}





