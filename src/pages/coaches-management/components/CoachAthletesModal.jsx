import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const CoachAthletesModal = ({ coach, onClose }) => {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAthletes = async () => {
      if (!coach?.id) return;
      try {
        // Traemos atletas vinculados a este coach_id
        const { data, error } = await supabase
          .from('athletes')
          .select(`
            id, status, join_date,
            profiles:profile_id (full_name, email, avatar_url)
          `)
          .eq('coach_id', coach.id);

        if (error) throw error;
        setAthletes(data || []);
      } catch (err) {
        console.error("Error trayendo atletas:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAthletes();
  }, [coach]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-modal flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl h-[80vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-heading font-bold text-foreground">Atletas Asignados</h2>
            <p className="text-sm text-muted-foreground">Profesor: {coach.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Lista Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <div className="text-center py-10">Cargando...</div>
          ) : athletes.length > 0 ? (
            athletes.map((ath) => (
              <div key={ath.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-smooth">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-background border border-border">
                  {ath.profiles?.avatar_url ? (
                    <Image src={ath.profiles.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Icon name="User" size={16} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground truncate">{ath.profiles?.full_name}</h4>
                  <p className="text-xs text-muted-foreground truncate">{ath.profiles?.email}</p>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  ath.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  {ath.status}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 flex flex-col items-center text-muted-foreground">
              <Icon name="Users" size={40} className="mb-2 opacity-20" />
              <p>Sin atletas asignados actualmente.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/10">
          <Button fullWidth variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
};

export default CoachAthletesModal;