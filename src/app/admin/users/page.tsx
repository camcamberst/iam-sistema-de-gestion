"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        if (data?.success !== false) setUsers(data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1>Gestión de Usuarios</h1>
      <div style={{ marginBottom: 16 }}>
        <Link className="aim-link" href="/admin/users/create">+ Crear Usuario</Link>
      </div>
      {loading ? <div>Cargando...</div> : (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Grupos</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{(u.groups||[]).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}





