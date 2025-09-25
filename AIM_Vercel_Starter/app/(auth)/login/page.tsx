"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("prueba@firestore.com");
  const [password, setPassword] = useState("prueba123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error de autenticación");
      setSuccess("Login exitoso");
      // Redirigir luego al dashboard
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(10px)",
        borderRadius: 20,
        padding: 40,
        width: "100%",
        maxWidth: 400,
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "#667eea", marginBottom: 10 }}>🎯</div>
        <h1>INICIAR SESIÓN</h1>
        <p style={{ color: "#666", marginBottom: 30, fontSize: ".9rem" }}>Sistema de Gestión AIM - Versión 3.0</p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <label htmlFor="email" style={{ display: "block", marginBottom: 8, color: "#333", fontWeight: 500 }}>EMAIL</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", border: "2px solid #e1e5e9", borderRadius: 10, fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <label htmlFor="password" style={{ display: "block", marginBottom: 8, color: "#333", fontWeight: 500 }}>CONTRASEÑA</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: "12px 16px", border: "2px solid #e1e5e9", borderRadius: 10, fontSize: 16 }} />
          </div>
          <button disabled={loading} style={{
            width: "100%", padding: 14, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 600, cursor: "pointer"
          }}>{loading ? "Cargando..." : "INICIAR SESIÓN"}</button>
        </form>

        {error && <div style={{ color: "#e74c3c", marginTop: 15, padding: 10, background: "rgba(231,76,60,0.1)", borderRadius: 8 }}>{error}</div>}
        {success && <div style={{ color: "#27ae60", marginTop: 15, padding: 10, background: "rgba(39,174,96,0.1)", borderRadius: 8 }}>{success}</div>}
      </div>
    </div>
  );
}


