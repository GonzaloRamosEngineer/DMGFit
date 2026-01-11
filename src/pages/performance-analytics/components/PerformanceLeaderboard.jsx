import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const PerformanceLeaderboard = ({ athletes, onAthleteClick, loading = false }) => {
  
  const getRankChangeIcon = (change) => {
    if (!change) return { name: 'Minus', color: 'var(--color-muted-foreground)' };
    if (change > 0) return { name: 'ArrowUp', color: 'var(--color-success)' };
    if (change < 0) return { name: 'ArrowDown', color: 'var(--color-error)' };
    return { name: 'Minus', color: 'var(--color-muted-foreground)' };
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
           {[1, 2, 3, 4, 5].map(i => (
             <div key={i} className="h-16 bg-muted/30 rounded-lg w-full"></div>
           ))}
        </div>
      </div>
    );
  }

  if (!athletes || athletes.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <Icon name="Users" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">Sin datos suficientes</h3>
        <p className="text-muted-foreground">Registra más métricas para generar la clasificación.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg lg:text-xl font-heading font-semibold text-foreground mb-1">
            Clasificación de Rendimiento
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Top atletas basado en progreso
          </p>
        </div>
        <Icon name="Award" size={20} color="var(--color-primary)" className="md:w-6 md:h-6" />
      </div>
      
      <div className="space-y-2 md:space-y-3">
        {athletes.map((athlete, index) => {
          const rankChange = getRankChangeIcon(athlete.rankChange);
          
          return (
            <div
              key={athlete.id}
              onClick={() => onAthleteClick && onAthleteClick(athlete)}
              className={`
                flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-lg border transition-smooth cursor-pointer
                ${index < 3 ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'}
                hover:bg-primary/10 hover:border-primary/30
              `}
            >
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-background border border-border flex-shrink-0">
                <span className={`text-sm md:text-base font-heading font-bold ${index < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {index + 1}
                </span>
              </div>
              
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-primary/20 flex-shrink-0 bg-background flex items-center justify-center">
                {athlete.avatar || athlete.avatar_url ? (
                  <Image
                    src={athlete.avatar || athlete.avatar_url}
                    alt={athlete.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Icon name="User" size={20} className="text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm md:text-base font-medium text-foreground truncate">
                    {athlete.name}
                  </p>
                  {index === 0 && (
                     <Icon name="Trophy" size={14} color="var(--color-secondary)" className="flex-shrink-0 md:w-4 md:h-4" />
                  )}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {athlete.email || 'Atleta'}
                </p>
              </div>
              
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-base md:text-lg font-heading font-bold text-foreground">
                    {athlete.score ? `${athlete.score}%` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">mejora</p>
                </div>
                
                {athlete.rankChange !== undefined && (
                  <div className="flex items-center gap-1">
                    <Icon name={rankChange.name} size={14} color={rankChange.color} className="md:w-4 md:h-4" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PerformanceLeaderboard;