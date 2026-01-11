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

const RevenueChart = ({ data, paymentMethodData, loading = false }) => {
  
  // Cálculo de totales (Tu lógica original, muy útil)
  const totals = useMemo(() => {
    if (!paymentMethodData?.length) {
      return { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 };
    }
    return paymentMethodData.reduce(
      (acc, item) => {
        const methodKey = item?.method?.toLowerCase();
        const value = Number(item?.value || 0);
        return {
          ...acc,
          [methodKey]: (acc[methodKey] || 0) + value,
          total: acc.total + value
        };
      },
      { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 }
    );
  }, [paymentMethodData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground capitalize">{entry.name}</span>
              <span className="text-xs font-medium text-foreground">
                ${Number(entry.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="h-6 bg-muted/50 rounded w-1/3 mb-6"></div>
        <div className="flex gap-4 mb-6">
           {[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted/30 rounded w-20"></div>)}
        </div>
        <div className="h-56 bg-muted/30 rounded w-full"></div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 h-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground mb-1">
            Ingresos por Método
          </h3>
          <p className="text-sm text-muted-foreground">
            Comparativa mensual de ingresos
          </p>
        </div>
        
        {/* Resumen de Totales (Tu diseño original) */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <div className="px-3 py-2 bg-muted/30 rounded-lg">
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-sm font-semibold text-foreground">${totals.total.toLocaleString()}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30 rounded-lg border-l-2 border-[#3B82F6]">
            <p className="text-[10px] text-muted-foreground uppercase">Tarjeta</p>
            <p className="text-sm font-semibold text-foreground">${totals.tarjeta?.toLocaleString() || 0}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30 rounded-lg border-l-2 border-[#8B5CF6]">
            <p className="text-[10px] text-muted-foreground uppercase">Transf.</p>
            <p className="text-sm font-semibold text-foreground">${totals.transferencia?.toLocaleString() || 0}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30 rounded-lg border-l-2 border-[#10B981]">
            <p className="text-[10px] text-muted-foreground uppercase">Efectivo</p>
            <p className="text-sm font-semibold text-foreground">${totals.efectivo?.toLocaleString() || 0}</p>
          </div>
        </div>
      </div>

      <div className="w-full h-64 sm:h-72 md:h-80" aria-label="Revenue Chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} vertical={false} />
            <XAxis 
              dataKey="month" 
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis 
              tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(value) => `$${value/1000}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--color-muted)', opacity: 0.1}} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            {/* Colores consistentes con el diseño */}
            <Bar dataKey="tarjeta" name="Tarjeta" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} />
            <Bar dataKey="transferencia" name="Transferencia" stackId="a" fill="#8B5CF6" />
            <Bar dataKey="efectivo" name="Efectivo" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;