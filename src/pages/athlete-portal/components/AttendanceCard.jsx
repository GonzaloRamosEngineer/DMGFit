import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Icon from '../../../components/AppIcon';

const AttendanceCard = ({ attendance, attendanceRate }) => {
  const presentCount = attendance?.filter(a => a?.status === 'present')?.length || 0;
  
  // Datos para el anillo (recharts)
  const data = [
    { name: 'Present', value: attendanceRate, color: '#10B981' }, // Emerald-500
    { name: 'Remaining', value: 100 - attendanceRate, color: '#F3F4F6' } // Gray-100
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
      <div className="flex justify-between items-start z-10">
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Disciplina</h2>
          <p className="text-xl font-bold text-gray-900 mt-1">Asistencia</p>
        </div>
        <Icon name="CheckCircle" size={20} className="text-emerald-500" />
      </div>

      <div className="flex items-center justify-center my-4 relative z-10">
        <div className="w-32 h-32 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={60}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Texto central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-800">{attendanceRate}%</span>
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Tasa</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3 z-10">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{presentCount}</p>
          <p className="text-xs text-gray-500">Clases</p>
        </div>
        <div className="h-8 w-px bg-gray-200"></div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{attendance?.length || 0}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCard;