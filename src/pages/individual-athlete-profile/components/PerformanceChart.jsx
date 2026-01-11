import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import Icon from '../../../components/AppIcon';

const PerformanceChart = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="w-full h-64 md:h-80 lg:h-96 bg-muted/20 animate-pulse rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">Cargando gráfico...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 md:h-80 lg:h-96 flex flex-col items-center justify-center border border-dashed border-border rounded-lg bg-muted/10">
        <Icon name="BarChart2" size={48} className="text-muted-foreground opacity-30 mb-4" />
        <p className="text-muted-foreground">No hay datos suficientes para mostrar la evolución.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium text-foreground data-text">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-6">
      <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Evolución de Rendimiento</h3>
      <div className="w-full h-64 md:h-80 lg:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
              tickMargin={10}
            />
            <YAxis 
              stroke="var(--color-muted-foreground)"
              style={{ fontSize: '12px' }}
              domain={['auto', 'auto']} // Ajuste dinámico
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            
            {/* Solo renderizamos líneas si existen datos para esa métrica */}
            <Line type="monotone" dataKey="value" name="Métrica Principal" stroke="var(--color-primary)" strokeWidth={2} dot={{r:4}} />
            {/* Si tu data tiene claves específicas como 'fuerza', 'resistencia', etc., úsalas aquí */}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChart;