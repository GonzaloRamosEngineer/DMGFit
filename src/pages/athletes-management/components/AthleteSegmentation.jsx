import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Skeleton } from '../../../components/ui/Skeleton';

const AthleteSegmentation = ({ segmentationData, loading = false }) => {
  // Arranca colapsado para no saturar la pantalla; la cabecera lo despliega.
  const [expanded, setExpanded] = React.useState(false);

  // Colores de DATO para el gráfico (recharts requiere hex). Paleta de categoría
  // intencional — distinta de los tokens de marca.
  const COLORS = {
    elite: '#10b981',      // emerald-500
    advanced: '#3b82f6',   // blue-500
    intermediate: '#fbbf24', // amber-400
    beginner: '#f97316'    // orange-500
  };

  if (loading) {
    return (
      <Card padding="default">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-16 rounded-xl" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full mt-5" />
      </Card>
    );
  }

  const chartData = [
    { name: 'Elite', value: segmentationData?.elite || 0, color: COLORS.elite },
    { name: 'Avanzado', value: segmentationData?.advanced || 0, color: COLORS.advanced },
    { name: 'Intermedio', value: segmentationData?.intermediate || 0, color: COLORS.intermediate },
    { name: 'Principiante', value: segmentationData?.beginner || 0, color: COLORS.beginner }
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const hasData = chartData.length > 0;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const percentage = ((payload[0].value / total) * 100).toFixed(1);
      return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-xl">
          <p className="text-sm font-black text-text-primary mb-1">{payload[0].name}</p>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: payload[0].payload.color }}
            />
            <p className="text-xs font-bold text-text-secondary">
              {payload[0].value} atletas · {percentage}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Barra de distribución compacta (siempre visible): proporciones de un vistazo.
  const DistributionBar = () => (
    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted">
      {hasData ? (
        chartData.map((s) => (
          <div
            key={s.name}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.name}: ${s.value}`}
          />
        ))
      ) : (
        <div className="w-full bg-border" />
      )}
    </div>
  );

  return (
    <Card padding="default" className="hover:shadow-md transition-shadow duration-300">
      {/* Cabecera: botón que despliega / colapsa */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-info-light text-primary flex items-center justify-center shadow-inner shrink-0">
            <Icon name="PieChart" size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-text-primary tracking-tight truncate">
              Segmentación
            </h3>
            <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mt-0.5 truncate">
              Por nivel de rendimiento
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className="inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2.5 rounded-xl bg-muted border border-border text-base font-black text-text-primary"
            title={`${total} atletas en total`}
          >
            {total}
          </span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary bg-muted/60">
            <Icon
              name="ChevronDown"
              size={18}
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </button>

      {/* Barra de distribución (siempre visible cuando está colapsado) */}
      {!expanded && (
        <div className="mt-5">
          <DistributionBar />
        </div>
      )}

      {/* Contenido desplegable */}
      {expanded && (
        <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {hasData ? (
            <>
              {/* Donut */}
              <div className="h-[200px] w-full" aria-label="Gráfico de segmentación">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={82}
                      innerRadius={52}
                      paddingAngle={chartData.length > 1 ? 4 : 0}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity cursor-pointer stroke-white stroke-2"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista de niveles */}
              <div className="space-y-3 mt-4">
                {chartData.map((segment) => {
                  const percentage = ((segment.value / total) * 100).toFixed(1);
                  return (
                    <div key={segment.name}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: segment.color }} />
                          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider truncate">
                            {segment.name}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 shrink-0">
                          <span className="text-sm font-black text-text-primary">{segment.value}</span>
                          <span className="text-[10px] font-bold text-text-tertiary tabular-nums">{percentage}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${percentage}%`, backgroundColor: segment.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center bg-muted/50 rounded-2xl border-2 border-dashed border-border py-8">
              <EmptyState
                iconName="PieChart"
                title="Sin Datos Aún"
                description="La segmentación aparecerá cuando registres atletas."
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default AthleteSegmentation;
