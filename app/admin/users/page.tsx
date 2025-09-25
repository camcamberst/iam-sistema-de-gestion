export default function UsersListPage() {
  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold mb-6">Gestión de Usuarios</h1>
      <p className="text-lg mb-4">Listado de usuarios. (Conectaremos datos y acciones después del deploy estable.)</p>

      <div className="bg-aim-card border border-aim-border rounded-lg p-6 shadow-md backdrop-blur-glass">
        <h2 className="text-xl font-semibold mb-4">Usuarios del Sistema</h2>
        <table className="min-w-full text-left text-sm font-light">
          <thead className="border-b border-aim-border font-medium">
            <tr>
              <th scope="col" className="px-6 py-4">#</th>
              <th scope="col" className="px-6 py-4">Nombre</th>
              <th scope="col" className="px-6 py-4">Email</th>
              <th scope="col" className="px-6 py-4">Rol</th>
              <th scope="col" className="px-6 py-4">Grupo(s)</th>
              <th scope="col" className="px-6 py-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-aim-border">
              <td className="whitespace-nowrap px-6 py-4 font-medium">1</td>
              <td className="whitespace-nowrap px-6 py-4">Super Admin</td>
              <td className="whitespace-nowrap px-6 py-4">superadmin@example.com</td>
              <td className="whitespace-nowrap px-6 py-4">Super Admin</td>
              <td className="whitespace-nowrap px-6 py-4">N/A</td>
              <td className="whitespace-nowrap px-6 py-4">Editar | Eliminar</td>
            </tr>
            <tr className="border-b border-aim-border">
              <td className="whitespace-nowrap px-6 py-4 font-medium">2</td>
              <td className="whitespace-nowrap px-6 py-4">Admin Uno</td>
              <td className="whitespace-nowrap px-6 py-4">admin1@example.com</td>
              <td className="whitespace-nowrap px-6 py-4">Admin</td>
              <td className="whitespace-nowrap px-6 py-4">Cabecera, Diamante</td>
              <td className="whitespace-nowrap px-6 py-4">Editar | Eliminar</td>
            </tr>
            <tr className="border-b border-aim-border">
              <td className="whitespace-nowrap px-6 py-4 font-medium">3</td>
              <td className="whitespace-nowrap px-6 py-4">Modelo Alfa</td>
              <td className="whitespace-nowrap px-6 py-4">modelo1@example.com</td>
              <td className="whitespace-nowrap px-6 py-4">Modelo</td>
              <td className="whitespace-nowrap px-6 py-4">Cabecera</td>
              <td className="whitespace-nowrap px-6 py-4">Editar | Eliminar</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}