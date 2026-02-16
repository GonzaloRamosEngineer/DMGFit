import React from 'react';
import Icon from '../../../components/AppIcon';

// Helper para calcular métricas avanzadas
const getLatest = (metrics, name) => {
    const sorted = metrics
        .filter(m => m.name === name)
        .sort((a, b) => new Date(b.metric_date) - new Date(a.metric_date));
    return sorted.length ? parseFloat(sorted[0].value) : 0;
};

const StatCard = ({ title, value, subtitle, icon, color, trend }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon name={icon} size={20} className="text-white" />
        </div>
        {trend && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {trend > 0 ? '+' : ''}{trend}%
            </span>
        )}
    </div>
    <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</h4>
    <div className="flex items-baseline gap-1">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h2>
        <span className="text-xs font-bold text-slate-400">{subtitle}</span>
    </div>
  </div>
);

const StatsOverview = ({ metrics, attendanceRate }) => {
    const weight = getLatest(metrics, 'Peso Corporal');
    const squat = getLatest(metrics, 'Sentadilla');
    const deadlift = getLatest(metrics, 'Peso Muerto');
    
    // CALCULO PRO: Ratio de Fuerza (Fuerza Total / Peso Corporal)
    const strengthRatio = weight > 0 ? ((squat + deadlift) / weight).toFixed(2) : '-';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard 
                title="Consistencia"
                value={`${attendanceRate}%`}
                subtitle="ASISTENCIA"
                icon="Calendar"
                color="bg-slate-900"
            />
            <StatCard 
                title="Fuerza Relativa"
                value={`${strengthRatio}x`}
                subtitle="PESO CORPORAL"
                icon="Zap"
                color="bg-blue-600"
                trend={1.5}
            />
            <StatCard 
                title="Carga Máxima"
                value={deadlift}
                subtitle="KG (PESO MUERTO)"
                icon="TrendingUp"
                color="bg-emerald-500"
                trend={5.2}
            />
            <StatCard 
                title="Composición"
                value={weight}
                subtitle="KG ACTUALES"
                icon="User"
                color="bg-purple-500"
                trend={-0.8}
            />
        </div>
    );
};

export default StatsOverview;