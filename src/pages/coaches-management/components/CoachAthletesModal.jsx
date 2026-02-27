import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const CoachAthletesModal = ({ coach, onClose }) => {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');

  useEffect(() => {
    const fetchAthletes = async () => {
      if (!coach?.id) return;
      try {
        let query = supabase
          .from('athletes')
          .select(`
            id, status, join_date,
            profiles:profile_id (full_name, email, avatar_url)
          `)
          .eq('coach_id', coach.id);

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;
        setAthletes(data || []);
      } catch (err) {
        console.error("Error trayendo atletas:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAthletes();
  }, [coach, statusFilter]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      
      {/* Contenedor Modal */}
      <div className="bg-white border border-slate-100 rounded-[2rem] w-full max-w-lg shadow-2xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
              <Icon name="Users" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Atletas Asignados</h2>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Profesor: {coach.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 gap-1">
            {[
              { id: 'active', label: 'Activos' },
              { id: 'inactive', label: 'Inactivos' },
              { id: 'all', label: 'Todos' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === item.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar bg-slate-50/30">
          {loading ? (
            // Skeleton Loader
            [1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-slate-100"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                </div>
                <div className="w-16 h-6 bg-slate-100 rounded-lg"></div>
              </div>
            ))
          ) : athletes.length > 0 ? (
            athletes.map((ath) => (
              <div 
                key={ath.id} 
                className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all group cursor-default"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0 relative">
                  {ath.profiles?.avatar_url ? (
                    <Image src={ath.profiles.avatar_url} alt={ath.profiles?.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Icon name="User" size={20} />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-800 truncate">{ath.profiles?.full_name}</h4>
                  <p className="text-[11px] font-medium text-slate-400 truncate">{ath.profiles?.email || 'Sin email registrado'}</p>
                </div>
                
                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                  ath.status === 'active' 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {ath.status === 'active' ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <Icon name="Users" size={28} className="text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-700 mb-1">Sin atletas asignados</p>
              <p className="text-xs font-medium text-slate-400 max-w-[250px]">
                Aún no has vinculado a ningún alumno con este profesor.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default CoachAthletesModal;