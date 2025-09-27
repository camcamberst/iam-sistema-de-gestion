"use client";
import { useState, useEffect } from 'react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  success: boolean;
  ip_address?: string;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    severity: '',
    action: '',
    success: ''
  });

  useEffect(() => {
    loadAuditLogs();
  }, [filter]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/audit');
      const data = await response.json();
      
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Error cargando logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-900';
      case 'high': return 'text-orange-500 bg-orange-900';
      case 'medium': return 'text-yellow-500 bg-yellow-900';
      case 'low': return 'text-green-500 bg-green-900';
      default: return 'text-gray-500 bg-gray-900';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter.severity && log.severity !== filter.severity) return false;
    if (filter.action && !log.action.includes(filter.action)) return false;
    if (filter.success !== '' && log.success.toString() !== filter.success) return false;
    return true;
  });

  return (
    <div className="min-h-screen" style={{
      background: 'radial-gradient(1200px 800px at 10% -10%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgb(16 18 27), rgb(16 18 27))'
    }}>
      <div className="p-6">
        <h1 className="text-4xl font-bold text-white mb-6">Auditoría del Sistema</h1>
        
        {/* Filtros */}
        <div className="bg-aim-card border border-aim-border rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Severidad</label>
              <select
                value={filter.severity}
                onChange={(e) => setFilter({...filter, severity: e.target.value})}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Todas</option>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-2">Acción</label>
              <input
                type="text"
                value={filter.action}
                onChange={(e) => setFilter({...filter, action: e.target.value})}
                placeholder="Buscar acción..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>
            
            <div>
              <label className="block text-gray-300 text-sm mb-2">Estado</label>
              <select
                value={filter.success}
                onChange={(e) => setFilter({...filter, success: e.target.value})}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="">Todos</option>
                <option value="true">Exitoso</option>
                <option value="false">Fallido</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-aim-card border border-aim-border rounded-xl">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Logs de Auditoría ({filteredLogs.length})
            </h2>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="text-white text-xl">Cargando logs...</div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-lg">No hay logs disponibles</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-aim-border">
                    <tr>
                      <th className="px-6 py-4 text-gray-300 font-medium">Timestamp</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Usuario</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Acción</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Severidad</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Descripción</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">Estado</th>
                      <th className="px-6 py-4 text-gray-300 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b border-aim-border hover:bg-gray-800/50">
                        <td className="px-6 py-4 text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-white">
                          {log.user_id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 text-white">
                          {log.action}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(log.severity)}`}>
                            {log.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white">
                          {log.description}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            log.success 
                              ? 'text-green-400 bg-green-900' 
                              : 'text-red-400 bg-red-900'
                          }`}>
                            {log.success ? 'ÉXITO' : 'FALLIDO'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {log.ip_address || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
