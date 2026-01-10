import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';


const PaymentMethodChart = ({ data }) => {
  const COLORS = {
    efectivo: '#FFD700',
    tarjeta: '#FF4444',
    transferencia: '#00D4FF'
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-1">{data?.name}</p>
          <p className="text-xs text-muted-foreground">
            €{data?.value?.toLocaleString()} ({data?.payload?.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-data font-bold"
      >
        {`${percentage}%`}
      </text>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="mb-6">
        <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
          Métodos de Pago
        </h3>
        <p className="text-sm text-muted-foreground">
          Distribución por tipo de pago
        </p>
      </div>
      <div className="w-full h-64 md:h-80" aria-label="Payment Method Distribution Chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS?.[entry?.method]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 space-y-3">
        {data?.map((item) => (
          <div key={item?.method} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: COLORS?.[item?.method] }}
              />
              <span className="text-sm font-medium text-foreground">{item?.name}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-data font-semibold text-foreground">
                €{item?.value?.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{item?.percentage}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentMethodChart;