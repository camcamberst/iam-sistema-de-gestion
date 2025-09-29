// Script para corregir deshabilitación de grupos para modelos
const fs = require('fs');

// Leer el archivo
const filePath = 'app/admin/users/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Reemplazar la sección de grupos en CreateUserModal
const oldPattern = `              {groups.map((group) => (
                <label key={group.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.group_ids.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          group_ids: [...formData.group_ids, group.id]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          group_ids: formData.group_ids.filter(id => id !== group.id)
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-white">{group.name}</span>
                </label>
              ))}`;

const newPattern = `              {groups.map((group) => {
                const isChecked = formData.group_ids.includes(group.id);
                const isDisabled = formData.role === 'modelo' && 
                                 formData.group_ids.length > 0 && 
                                 !isChecked;
                
                return (
                  <label key={group.id} className={\`flex items-center space-x-2 \${isDisabled ? 'opacity-50' : ''}\`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            group_ids: [...formData.group_ids, group.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            group_ids: formData.group_ids.filter(id => id !== group.id)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span className={\`text-white \${isDisabled ? 'text-gray-400' : ''}\`}>
                      {group.name}
                      {isDisabled && <span className="text-xs text-gray-500 ml-1">(deshabilitado)</span>}
                    </span>
                  </label>
                );
              })}`;

// Reemplazar solo la primera ocurrencia (CreateUserModal)
const firstIndex = content.indexOf(oldPattern);
if (firstIndex !== -1) {
  content = content.substring(0, firstIndex) + newPattern + content.substring(firstIndex + oldPattern.length);
}

// Escribir el archivo corregido
fs.writeFileSync(filePath, content);
console.log('✅ Archivo corregido exitosamente');
