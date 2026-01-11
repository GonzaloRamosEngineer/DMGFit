import React, { useState } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const AttendancePerformanceChart = ({ data, onDrillDown, loading = false }) => {
  const [activeView, setActiveView] = useState('week');

  const viewOptions = [
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
    { value: 'quarter', label: 'Trimestre' }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg z-50">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between space-x-4 text-xs">
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.name === 'Asistencia' ? `${entry.value}%` : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // 1. ESTADO DE CARGA VISUAL
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse">
        <div className="flex justify-between mb-6">
          <div className="h-6 bg-muted/50 rounded w-1/3"></div>
          <div className="h-8 bg-muted/50 rounded w-1/4"></div>
        </div>
        <div className="h-64 bg-muted/30 rounded w-full"></div>
        <div className="mt-4 pt-4 border-t border-border flex justify-between">
          <div className="h-4 bg-muted/50 rounded w-1/4"></div>
          <div className="h-4 bg-muted/50 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h3 className="text-lg md:text-xl font-heading font-semibold text-foreground">
            Asistencia y Rendimiento
          </h3>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Correlación entre asistencia y métricas de rendimiento
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {viewOptions.map((option) => (
            <Button
              key={option.value}
              variant={activeView === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="w-full h-64 md:h-80 lg:h-96" aria-label="Gráfico de asistencia y rendimiento">
        <ResponsiveContainer width="100%" height="100%">
          {/* 2. PROTECCIÓN CONTRA DATOS VACÍOS */}
          {data && data.length > 0 ? (
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
              <XAxis 
                dataKey="period" 
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                yAxisId="left"
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
                label={{ value: 'Asistencia (%)', angle: -90, position: 'insideLeft', style: { fill: 'var(--color-muted-foreground)', fontSize: '12px' } }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '12px' }}
                label={{ value: 'Rendimiento', angle: 90, position: 'insideRight', style: { fill: 'var(--color-muted-foreground)', fontSize: '12px' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Bar 
                yAxisId="left"
                dataKey="attendance" 
                name="Asistencia"
                fill="var(--color-primary)" 
                radius={[4, 4, 0, 0]}
                onClick={(data) => onDrillDown && onDrillDown(data)}
                style={{ cursor: 'pointer' }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="performance" 
                name="Rendimiento"
                stroke="var(--color-secondary)" 
                strokeWidth={3}
                dot={{ fill: 'var(--color-secondary)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No hay datos disponibles para mostrar el gráfico.
            </div>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <div>
              <p className="text-xs text-muted-foreground">Asistencia Promedio</p>
              <p className="text-sm md:text-base font-medium text-foreground">87.5%</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-secondary"></div>
            <div>
              <p className="text-xs text-muted-foreground">Rendimiento Promedio</p>
              <p className="text-sm md:text-base font-medium text-foreground">8.2/10</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Icon name="TrendingUp" size={16} color="var(--color-success)" />
            <div>
              <p className="text-xs text-muted-foreground">Correlación</p>
              <p className="text-sm md:text-base font-medium text-success">+12.3%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePerformanceChart;