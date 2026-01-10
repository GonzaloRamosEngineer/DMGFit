import React from 'react';
import Icon from '../../../components/AppIcon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MetricsCard = ({ metrics }) => {
  const chartData = metrics?.map(m => ({
    name: m?.name,
    value: m?.value
  })) || [];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">Mis Métricas</h2>
        <Icon name="Activity" size={24} color="var(--color-secondary)" />
      </div>

      {metrics && metrics?.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {metrics?.map((metric) => (
              <div key={metric?.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{metric?.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{metric?.value}</span>
                    <span className="text-xs text-muted-foreground">{metric?.unit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Icon
                    name={metric?.trend === 'up' ? 'TrendingUp' : metric?.trend === 'down' ? 'TrendingDown' : 'Minus'}
                    size={14}
                    color={metric?.trend === 'up' ? 'var(--color-success)' : metric?.trend === 'down' ? 'var(--color-error)' : 'var(--color-muted-foreground)'}
                  />
                  <span className="text-xs text-muted-foreground">{metric?.date}</span>
                </div>
              </div>
            ))}
          </div>

          {chartData?.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-primary)', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="Activity" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
          <p className="text-muted-foreground">No hay métricas registradas aún</p>
        </div>
      )}
    </div>
  );
};

export default MetricsCard;