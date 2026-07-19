import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

const MyAthletesSection = ({ athletes, followedIds, onToggleFollow }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('todos'); // 'todos' | 'siguiendo'

  const followed = followedIds || new Set();
  const isFollowing = (id) => followed.has(id);

  const followedCount = useMemo(
    () => (athletes || []).filter((a) => isFollowing(a.id)).length,
    [athletes, followed]
  );

  const visibleAthletes = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = (athletes || []).filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q)
    );
    if (tab === 'siguiendo') {
      list = list.filter((a) => isFollowing(a.id));
    } else {
      // "Todos": los seguidos primero (orden estable)
      list = [...list].sort(
        (a, b) => (isFollowing(b.id) ? 1 : 0) - (isFollowing(a.id) ? 1 : 0)
      );
    }
    return list;
  }, [athletes, searchQuery, tab, followed]);

  const tabBtn = (key, label) =>
    `px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
      tab === key
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-text-tertiary hover:bg-muted'
    }`;

  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm p-6 flex flex-col h-full min-h-0">

      {/* Header & Search */}
      <div className="flex flex-col gap-4 mb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-xl font-black text-text-primary flex items-center gap-2">
              <Icon name="Users" className="text-primary" />
              Todos los atletas
            </h3>
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-1">
              {visibleAthletes.length} {tab === 'siguiendo' ? 'en seguimiento' : 'atletas'}
            </p>
          </div>

          <div className="relative w-full sm:w-64 group">
            <Icon name="Search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-muted border-2 border-transparent focus:border-info-light focus:bg-card rounded-2xl outline-none font-medium text-text-secondary transition-all placeholder:text-text-tertiary text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/60 p-1 rounded-2xl w-fit">
          <button className={tabBtn('todos')} onClick={() => setTab('todos')}>Todos</button>
          <button className={tabBtn('siguiendo')} onClick={() => setTab('siguiendo')}>
            Siguiendo ({followedCount})
          </button>
        </div>
      </div>

      {/* Grid de Atletas (scroll interno en desktop) */}
      <div className="flex-1 lg:overflow-y-auto custom-scrollbar lg:-mr-2 lg:pr-2">
        {visibleAthletes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleAthletes.map((athlete) => {
              const following = isFollowing(athlete.id);
              return (
                <div
                  key={athlete.id}
                  className={`group relative border rounded-2xl p-4 hover:shadow-lg transition-all duration-300 flex items-center gap-4 ${
                    following ? 'border-amber-300 bg-amber-50/40' : 'bg-card border-border hover:border-info-light'
                  }`}
                >
                  {/* Avatar con anillo de estado */}
                  <div className="relative flex-shrink-0">
                    {athlete.avatar ? (
                      <img src={athlete.avatar} alt={athlete.name} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-muted text-text-tertiary flex items-center justify-center font-black text-lg">
                        {athlete.name.charAt(0)}
                      </div>
                    )}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${athlete.status === 'active' ? 'bg-success' : 'bg-text-tertiary'}`}></div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-text-primary truncate group-hover:text-primary transition-colors">{athlete.name}</h4>
                    <p className="text-xs text-text-tertiary truncate mb-2">{athlete.planName || 'Sin Plan'}</p>

                    {/* Mini Actions */}
                    <div className="flex gap-2 items-center flex-wrap">
                      <button
                        onClick={() => navigate(`/individual-athlete-profile/${athlete.id}`)}
                        className="text-[10px] font-bold uppercase tracking-wide bg-muted hover:bg-info-light text-text-secondary hover:text-primary px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ver Perfil
                      </button>

                      <button
                        onClick={() => onToggleFollow?.(athlete.id, !following)}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-colors ${
                          following
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-muted text-text-secondary hover:bg-primary/10 hover:text-primary'
                        }`}
                        title={following ? 'Dejar de seguir' : 'Hacer seguimiento'}
                      >
                        <Icon name={following ? 'Star' : 'Plus'} size={12} />
                        {following ? 'Siguiendo' : 'Seguir'}
                      </button>

                      {athlete.phone && (
                        <a href={`https://wa.me/${athlete.phone}`} target="_blank" rel="noreferrer" className="p-1.5 bg-success-light text-success rounded-lg hover:bg-success-light/70 transition-colors">
                          <Icon name="MessageCircle" size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-border rounded-3xl bg-muted/30">
            <Icon name={tab === 'siguiendo' ? 'Star' : 'Search'} size={32} className="mx-auto mb-3 text-text-tertiary" />
            <p className="text-sm font-bold text-text-tertiary">
              {tab === 'siguiendo' ? 'Todavía no seguís a ningún atleta.' : 'No se encontraron atletas'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyAthletesSection;
