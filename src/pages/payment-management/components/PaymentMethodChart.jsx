import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const PaymentMethodChart = ({ data, loading = false }) => {
  const COLORS = {
    efectivo: '#FFD700',
    tarjeta: '#FF4444',
    transferencia: '#00D4FF',
    otros: '#8884d8'
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/2 mb-6"></div>
        <div className="h-64 bg-muted/30 rounded-full w-64 mx-auto mb-6"></div>
        <div className="space-y-2">
          <div className="h-8 bg-muted/50 rounded"></div>
          <div className="h-8 bg-muted/50 rounded"></div>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-1">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            ${Number(item.value).toLocaleString()} ({item.payload.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const hasData = data && data.length > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
          Métodos de Pago
        </h3>
        <p className="text-sm text-muted-foreground">Distribución por tipo de pago</p>
      </div>

      {hasData ? (
        <>
          <div className="w-full h-64 md:h-80 flex-shrink-0" aria-label="Payment Method Chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.method.toLowerCase()] || COLORS.otros} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 space-y-3 flex-1 overflow-auto custom-scrollbar max-h-[200px]">
            {data.map((item) => (
              <div key={item.method} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[item.method.toLowerCase()] || COLORS.otros }} />
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-data font-semibold text-foreground">${item.value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
          <Icon name="PieChart" size={48} className="mb-4 opacity-50" />
          <p>No hay datos suficientes</p>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodChart;