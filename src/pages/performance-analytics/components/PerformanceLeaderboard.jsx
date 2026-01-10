import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const PerformanceLeaderboard = ({ athletes, onAthleteClick }) => {
  const getRankChangeIcon = (change) => {
    if (change > 0) return { name: 'ArrowUp', color: 'var(--color-success)' };
    if (change < 0) return { name: 'ArrowDown', color: 'var(--color-error)' };
    return { name: 'Minus', color: 'var(--color-muted-foreground)' };
  };

  const getBadgeIcon = (badge) => {
    const badges = {
      'top-performer': { name: 'Trophy', color: 'var(--color-secondary)' },
      'most-improved': { name: 'TrendingUp', color: 'var(--color-success)' },
      'consistent': { name: 'Target', color: 'var(--color-accent)' }
    };
    return badges?.[badge] || null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-base md:text-lg lg:text-xl font-heading font-semibold text-foreground mb-1">
            Clasificación de Rendimiento
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Top 10 atletas este mes
          </p>
        </div>
        <Icon name="Award" size={20} color="var(--color-primary)" className="md:w-6 md:h-6" />
      </div>
      <div className="space-y-2 md:space-y-3">
        {athletes?.map((athlete, index) => {
          const rankChange = getRankChangeIcon(athlete?.rankChange);
          const badge = getBadgeIcon(athlete?.badge);

          return (
            <div
              key={athlete?.id}
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
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-primary/20 flex-shrink-0">
                <Image
                  src={athlete?.avatar}
                  alt={athlete?.avatarAlt}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm md:text-base font-medium text-foreground truncate">
                    {athlete?.name}
                  </p>
                  {badge && (
                    <Icon name={badge?.name} size={14} color={badge?.color} className="flex-shrink-0 md:w-4 md:h-4" />
                  )}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {athlete?.category}
                </p>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-base md:text-lg font-heading font-bold text-foreground">
                    {athlete?.score}
                  </p>
                  <p className="text-xs text-muted-foreground">puntos</p>
                </div>
                
                <div className="flex items-center gap-1">
                  <Icon name={rankChange?.name} size={14} color={rankChange?.color} className="md:w-4 md:h-4" />
                  <span className="text-xs md:text-sm font-medium" style={{ color: rankChange?.color }}>
                    {Math.abs(athlete?.rankChange)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-border">
        <div className="grid grid-cols-3 gap-3 md:gap-4 text-center">
          <div>
            <div className="flex items-center justify-center mb-2">
              <Icon name="Trophy" size={16} color="var(--color-secondary)" className="md:w-5 md:h-5" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Top Performer</p>
            <p className="text-sm md:text-base font-medium text-foreground">Carlos M.</p>
          </div>
          <div>
            <div className="flex items-center justify-center mb-2">
              <Icon name="TrendingUp" size={16} color="var(--color-success)" className="md:w-5 md:h-5" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Más Mejorado</p>
            <p className="text-sm md:text-base font-medium text-foreground">Laura S.</p>
          </div>
          <div>
            <div className="flex items-center justify-center mb-2">
              <Icon name="Target" size={16} color="var(--color-accent)" className="md:w-5 md:h-5" />
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1">Consistente</p>
            <p className="text-sm md:text-base font-medium text-foreground">Ana R.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceLeaderboard;