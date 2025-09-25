export default function AdminDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold mb-6">Dashboard Administrativo</h1>
      <p className="text-lg mb-4">Bienvenido, Super Admin/Admin. Aquí verás un resumen de la actividad del sistema.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-aim-card border border-aim-border rounded-lg p-6 shadow-md backdrop-blur-glass">
          <h2 className="text-xl font-semibold mb-2">Usuarios Activos</h2>
          <p className="text-3xl font-bold">120</p>
        </div>
        <div className="bg-aim-card border border-aim-border rounded-lg p-6 shadow-md backdrop-blur-glass">
          <h2 className="text-xl font-semibold mb-2">Modelos Registrados</h2>
          <p className="text-3xl font-bold">85</p>
        </div>
        <div className="bg-aim-card border border-aim-border rounded-lg p-6 shadow-md backdrop-blur-glass">
          <h2 className="text-xl font-semibold mb-2">Grupos de Trabajo</h2>
          <p className="text-3xl font-bold">7</p>
        </div>
      </div>

      <div className="mt-8 bg-aim-card border border-aim-border rounded-lg p-6 shadow-md backdrop-blur-glass">
        <h2 className="text-xl font-semibold mb-4">Actividad Reciente</h2>
        <ul>
          <li className="mb-2">Usuario 'Juan Pérez' creó un nuevo modelo.</li>
          <li className="mb-2">Admin 'María García' actualizó el grupo 'Diamante'.</li>
          <li className="mb-2">Modelo 'Ana López' inició sesión.</li>
        </ul>
      </div>
    </div>
  );
}

