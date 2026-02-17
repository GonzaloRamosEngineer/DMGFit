import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

const MyAthletesSection = ({ athletes }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAthletes = athletes?.filter((athlete) =>
    athlete.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    athlete.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
      
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
           <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Icon name="Users" className="text-blue-600" />
              Mis Atletas
           </h3>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              {filteredAthletes?.length} Activos
           </p>
        </div>
        
        <div className="relative w-full sm:w-64 group">
           <Icon name="Search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
           <input
             type="text"
             placeholder="Buscar atleta..."
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-2xl outline-none font-medium text-slate-700 transition-all placeholder:text-slate-400 text-sm"
           />
        </div>
      </div>

      {/* Grid de Atletas */}
      {filteredAthletes?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAthletes.map((athlete) => (
            <div key={athlete.id} className="group relative bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-lg hover:border-blue-100 transition-all duration-300 flex items-center gap-4">
              
              {/* Avatar con anillo de estado */}
              <div className="relative flex-shrink-0">
                 {athlete.avatar ? (
                   <img src={athlete.avatar} alt={athlete.name} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                 ) : (
                   <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-black text-lg">
                     {athlete.name.charAt(0)}
                   </div>
                 )}
                 <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${athlete.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                 <h4 className="font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{athlete.name}</h4>
                 <p className="text-xs text-slate-400 truncate mb-2">{athlete.planName || 'Sin Plan'}</p>
                 
                 {/* Mini Actions */}
                 <div className="flex gap-2">
                    <button 
                      onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}
                      className="text-[10px] font-bold uppercase tracking-wide bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 px-3 py-1.5 rounded-lg transition-colors"
                    >
                       Ver Perfil
                    </button>
                    {athlete.phone && (
                       <a href={`https://wa.me/${athlete.phone}`} target="_blank" rel="noreferrer" className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                          <Icon name="MessageCircle" size={14} />
                       </a>
                    )}
                 </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30">
           <Icon name="Search" size={32} className="mx-auto mb-3 text-slate-300" />
           <p className="text-sm font-bold text-slate-400">No se encontraron atletas</p>
        </div>
      )}
    </div>
  );
};

export default MyAthletesSection;