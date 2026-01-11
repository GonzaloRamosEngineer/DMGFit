import React from 'react';
import Icon from '../../../components/AppIcon';

const HealthMetrics = ({ metrics, loading = false }) => {
  
  // Configuración visual (Tu diseño original)
  const getMetricIcon = (key) => {
    const map = {
      'Peso Corporal': 'Scale',
      'Altura': 'Ruler',
      'IMC': 'Activity',
      'Grasa Corporal': 'Percent',
      'Frecuencia Cardíaca': 'Heart',
      'Presión Arterial': 'Droplet'
    };
    return map[key] || 'Activity';
  };

  const getMetricColor = (key) => {
    const map = {
      'Peso Corporal': 'var(--color-primary)',
      'Altura': 'var(--color-accent)',
      'IMC': 'var(--color-secondary)',
      'Grasa Corporal': 'var(--color-warning)',
      'Frecuencia Cardíaca': 'var(--color-error)',
      'Presión Arterial': 'var(--color-success)'
    };
    return map[key] || 'var(--color-muted-foreground)';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-muted/50 w-1/2 mb-6 rounded"></div>
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/30 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  // Convertimos el objeto de métricas en array para renderizar
  // metrics viene como: { 'Peso Corporal': { value: 80, unit: 'kg', ... }, 'Altura': ... }
  const metricsList = Object.entries(metrics || {}).map(([key, data]) => ({
    label: key,
    ...data
  }));

  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
        Métricas de Salud
      </h3>
      
      {metricsList.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 md:gap-3">
          {metricsList.map((metric) => (
            <div 
              key={metric.label}
              className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                  <div 
                    className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${getMetricColor(metric.label)}20` }}
                  >
                    <Icon 
                      name={getMetricIcon(metric.label)} 
                      size={18} 
                      color={getMetricColor(metric.label)} 
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs md:text-sm text-muted-foreground truncate">
                      {metric.label}
                    </p>
                    <p className="text-base md:text-lg font-semibold text-foreground data-text">
                      {metric.value} <span className="text-sm font-normal text-muted-foreground">{metric.unit}</span>
                    </p>
                  </div>
                </div>
                
                {/* Si tuviéramos cálculo de cambio histórico, lo mostraríamos aquí */}
                {/* Por ahora mostramos la fecha del dato */}
                <div className="text-right">
                   <p className="text-[10px] text-muted-foreground">
                     {new Date(metric.date).toLocaleDateString()}
                   </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
          <Icon name="Activity" size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay datos de salud registrados</p>
        </div>
      )}

      {metricsList.length > 0 && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 md:p-4 mt-3 md:mt-4">
          <div className="flex items-start gap-2 md:gap-3">
            <Icon name="Info" size={18} color="var(--color-accent)" className="flex-shrink-0 mt-0.5" />
            <p className="text-xs md:text-sm text-foreground">
              Datos basados en los registros más recientes de rendimiento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthMetrics;