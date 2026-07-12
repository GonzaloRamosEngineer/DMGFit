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
    <div className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-modal flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">

      {/* Contenedor Modal */}
      <div className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-info-light text-primary flex items-center justify-center shadow-inner">
              <Icon name="Users" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-primary tracking-tight">Atletas Asignados</h2>
              <p className="text-xs font-bold text-text-tertiary mt-0.5">Profesor: {coach.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-text-tertiary hover:bg-muted hover:text-text-secondary transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-border bg-muted/60">
          <div className="inline-flex items-center rounded-xl border border-border bg-card p-1 gap-1">
            {[
              { id: 'active', label: 'Activos' },
              { id: 'inactive', label: 'Inactivos' },
              { id: 'all', label: 'Todos' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${statusFilter === item.id ? 'bg-primary text-primary-foreground' : 'text-text-secondary hover:bg-muted'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar bg-muted/30">
          {loading ? (
            // Skeleton Loader
            [1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-muted"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                </div>
                <div className="w-16 h-6 bg-muted rounded-lg"></div>
              </div>
            ))
          ) : athletes.length > 0 ? (
            athletes.map((ath) => (
              <div
                key={ath.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-border transition-all group cursor-default"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
                  {ath.profiles?.avatar_url ? (
                    <Image src={ath.profiles.avatar_url} alt={ath.profiles?.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-tertiary">
                      <Icon name="User" size={20} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-text-primary truncate">{ath.profiles?.full_name}</h4>
                  <p className="text-[11px] font-medium text-text-tertiary truncate">{ath.profiles?.email || 'Sin email registrado'}</p>
                </div>

                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                  ath.status === 'active'
                    ? 'bg-success-light text-success border-emerald-200'
                    : 'bg-muted text-text-secondary border-border'
                }`}>
                  {ath.status === 'active' ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-border rounded-3xl bg-card">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 border border-border">
                <Icon name="Users" size={28} className="text-text-tertiary" />
              </div>
              <p className="text-sm font-black text-text-secondary mb-1">Sin atletas asignados</p>
              <p className="text-xs font-medium text-text-tertiary max-w-[250px]">
                Aún no has vinculado a ningún atleta con este profesor.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-text-secondary bg-card border border-border hover:bg-muted transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default CoachAthletesModal;