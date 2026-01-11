import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const RevenueChart = ({ data, paymentMethodData }) => {
  const totals = useMemo(() => {
    if (!paymentMethodData?.length) {
      return {
        efectivo: 0,
        tarjeta: 0,
        transferencia: 0,
        total: 0
      };
    }

    return paymentMethodData?.reduce(
      (acc, item) => {
        const methodKey = item?.method;
        const value = Number(item?.value || 0);
        return {
          ...acc,
          [methodKey]: value,
          total: acc?.total + value
        };
      },
      { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 }
    );
  }, [paymentMethodData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) {
      return null;
    }

    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          {payload?.map((entry) => (
            <div key={entry?.name} className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground capitalize">{entry?.name}</span>
              <span className="text-xs font-medium text-foreground">
                €{entry?.value?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            Ingresos por Método
          </h3>
          <p className="text-sm text-muted-foreground">
            Comparativa mensual de ingresos
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap">
          <div className="px-3 py-2 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-semibold text-foreground">€{totals?.total?.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Tarjeta</p>
            <p className="text-sm font-semibold text-foreground">€{totals?.tarjeta?.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Transferencia</p>
            <p className="text-sm font-semibold text-foreground">€{totals?.transferencia?.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Efectivo</p>
            <p className="text-sm font-semibold text-foreground">€{totals?.efectivo?.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="w-full h-64 md:h-72" aria-label="Revenue Chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
            <XAxis dataKey="month" tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="tarjeta" stackId="a" fill="#FF4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="transferencia" stackId="a" fill="#00D4FF" radius={[4, 4, 0, 0]} />
            <Bar dataKey="efectivo" stackId="a" fill="#FFD700" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
