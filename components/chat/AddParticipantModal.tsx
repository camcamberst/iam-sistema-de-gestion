import React, { useState } from 'react';

interface AddParticipantModalProps {
  onClose: () => void;
  onAdd: (userId: string) => void;
  availableUsers: any[];
  currentParticipants: string[]; // IDs of users already in the conversation
}

const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  onClose,
  onAdd,
  availableUsers,
  currentParticipants
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar los que NO están ya en la conversación
  const addableUsers = availableUsers.filter(u => !currentParticipants.includes(u.id));
  
  const filteredUsers = addableUsers.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1A1A] w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-black/5 dark:border-white/10">
        <div className="p-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
          <h3 className="font-semibold text-gray-900 dark:text-white">Añadir Participante</h3>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-4">
          <div className="relative mb-4">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Buscar contacto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-[#2A2A2A] border-transparent focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] rounded-xl text-sm transition-all"
            />
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-4">No hay más contactos para añadir</p>
            ) : (
              filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => onAdd(user.id)}
                  className="flex items-center w-full p-2 text-left hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm shrink-0 mr-3">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name || user.email}</p>
                    <p className="text-xs text-gray-500 truncate">{user.role}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddParticipantModal;
