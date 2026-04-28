'use client';

import { useState } from 'react';

export default function BroadcastPage() {
  const [content, setContent] = useState('');
  const [roles, setRoles] = useState<string[]>(['modelo']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const toggleRole = (role: string) => {
    setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const send = async () => {
    setLoading(true);
    setResult('');
    try {
      const token = (await fetch('/api/auth/token').then(() => null)) as any; // placeholder si existe endpoint; la API real usa el header del cliente
      const res = await fetch('/api/chat/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: content.trim(), roles })
      });
      const data = await res.json();
      if (res.ok) setResult(`Enviado a ${data.recipients} usuarios`);
      else setResult(data.error || 'Error');
    } catch (e: any) {
      setResult(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Difusión (AIM Botty)</h1>
      <p className="text-sm text-gray-500">Envía mensajes informativos como Botty a roles o grupos autorizados.</p>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Contenido</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full bg-gray-800 text-white rounded-lg p-3 border border-gray-700"
          placeholder="Escribe el mensaje de difusión..."
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Roles destino</label>
        <div className="flex gap-3 text-sm">
          {['modelo','admin','super_admin'].map(r => (
            <label key={r} className="flex items-center gap-2">
              <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
              {r}
            </label>
          ))}
        </div>
      </div>
      <button onClick={send} disabled={loading || !content.trim()} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-600">
        {loading ? 'Enviando...' : 'Enviar difusión'}
      </button>
      {result && <div className="text-sm text-gray-300">{result}</div>}
    </div>
  );
}


