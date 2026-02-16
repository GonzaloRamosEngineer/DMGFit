import React, { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

// --- CONFIGURACIÓN Y UTILIDADES ---

// Colores del tema (Esmeralda para éxito/disciplina)
const THEME = {
  present: '#10B981', // Emerald-500
  absent: '#EF4444',  // Red-500
  empty: '#F1F5F9',   // Slate-100
  text: '#64748B'     // Slate-500
};

// Determina el estado cualitativo basado en el %
const getStatusLabel = (rate) => {
  if (rate >= 90) return { label: 'Imparable', color: 'text-emerald-600', icon: 'Trophy' };
  if (rate >= 75) return { label: 'Constante', color: 'text-blue-600', icon: 'TrendingUp' };
  if (rate >= 50) return { label: 'Regular', color: 'text-yellow-600', icon: 'Minus' };
  return { label: 'En Riesgo', color: 'text-red-500', icon: 'AlertTriangle' };
};

/**
 * HOOK: useAttendanceLogic
 * Procesa la lógica de rachas, historial reciente y datos del gráfico.
 */
const useAttendanceLogic = (attendance) => {
  return useMemo(() => {
    const validData = Array.isArray(attendance) ? attendance : [];
    
    // 1. Calcular Racha Actual (Streak)
    // Ordenamos por fecha descendente (más nuevo primero) para contar hacia atrás
    const sorted = [...validData].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 0;
    for (let session of sorted) {
      if (session.status === 'present') {
        streak++;
      } else {
        break; // Se rompe la racha si faltó o está pendiente
      }
    }

    // 2. Historial Visual (Últimos 7 registros)
    // Tomamos los últimos 7 para mostrar "puntitos" de estado
    const recentHistory = sorted.slice(0, 7).reverse(); // Revertimos para que el último esté a la derecha

    // 3. Cálculos Generales
    const total = validData.length;
    const presentCount = validData.filter(a => a.status === 'present').length;
    // Evitamos división por cero
    const rate = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    // 4. Datos para el Gráfico (Anillo)
    const chartData = [
      { name: 'Asistencias', value: rate, color: THEME.present },
      { name: 'Restante', value: 100 - rate, color: THEME.empty }
    ];

    return {
      rate,
      streak,
      presentCount,
      total,
      chartData,
      recentHistory,
      status: getStatusLabel(rate)
    };
  }, [attendance]);
};

// --- SUB-COMPONENTES ---

// Muestra los puntitos de las últimas clases
const HistoryDots = ({ history }) => (
  <div className="flex items-center gap-1.5 mt-2">
    {history.map((session, idx) => {
      let bgColor = 'bg-slate-200';
      if (session.status === 'present') bgColor = 'bg-emerald-500';
      if (session.status === 'absent') bgColor = 'bg-red-400';

      return (
        <div 
          key={idx} 
          className={`w-2 h-2 rounded-full ${bgColor} transition-all hover:scale-125`}
          title={`${session.date}: ${session.status}`}
        />
      );
    })}
    {/* Rellenar visualmente si hay pocos datos */}
    {Array.from({ length: Math.max(0, 7 - history.length) }).map((_, i) => (
      <div key={`empty-${i}`} className="w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />
    ))}
  </div>
);

// --- COMPONENTE PRINCIPAL ---

const AttendanceCard = ({ attendance }) => {
  const { rate, streak, presentCount, total, chartData, recentHistory, status } = useAttendanceLogic(attendance);
  
  // Si no hay datos, mostramos estado vacío elegante
  if (total === 0) {
     return (
        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm h-full flex flex-col items-center justify-center text-center opacity-60">
            <Icon name="Calendar" size={32} className="text-slate-300 mb-2"/>
            <p className="text-xs font-bold uppercase text-slate-400">Sin historial</p>
        </div>
     );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] h-full relative overflow-hidden flex flex-col justify-between group">
      
      {/* Decoración de fondo */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-[40px] -mr-10 -mt-10 transition-opacity opacity-50 group-hover:opacity-100"></div>

      {/* HEADER */}
      <div className="flex justify-between items-start z-10 mb-2">
        <div>
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Disciplina</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className={`text-lg font-black tracking-tight ${status.color}`}>
                {status.label}
             </span>
             <Icon name={status.icon} size={14} className={status.color} />
          </div>
        </div>
        
        {/* Streak Badge (Racha) */}
        {streak > 1 && (
            <div className="flex flex-col items-center bg-orange-50 px-2 py-1.5 rounded-xl border border-orange-100">
                <Icon name="Flame" size={16} className="text-orange-500 animate-pulse" fill="currentColor" />
                <span className="text-[9px] font-black text-orange-600 uppercase tracking-wide">
                    {streak} días
                </span>
            </div>
        )}
      </div>

      {/* CHART SECTION */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-2">
        <div className="w-36 h-36 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55} // Anillo más fino
                outerRadius={65}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                cornerRadius={10} // Bordes redondeados modernos
                paddingAngle={5}  // Espacio entre secciones si hubiera más de una
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Texto Central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-4xl font-black text-slate-800 tracking-tighter">
              {rate}<span className="text-lg text-slate-400">%</span>
            </span>
          </div>
        </div>

        {/* Visual History (Puntitos) */}
        <div className="flex flex-col items-center mt-2">
           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Últimas Sesiones</span>
           <HistoryDots history={recentHistory} />
        </div>
      </div>

      {/* FOOTER STATS */}
      <div className="flex justify-between items-center bg-slate-50/80 rounded-2xl p-4 mt-2 border border-slate-100 backdrop-blur-sm z-10">
        <div className="text-center w-1/2 border-r border-slate-200">
          <p className="text-xl font-black text-slate-800 tracking-tight leading-none">{presentCount}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Asistencias</p>
        </div>
        <div className="text-center w-1/2">
          <p className="text-xl font-black text-slate-400 tracking-tight leading-none">{total}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total Clases</p>
        </div>
      </div>

    </div>
  );
};

export default AttendanceCard;