import React from 'react';
import Icon from '../../../components/AppIcon';

const MyPlanCard = ({ plan }) => {
  if (!plan) return null; // Si no hay plan, no mostramos nada o un placeholder simple

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gray-900 text-white shadow-xl min-h-[200px] flex flex-col justify-between p-6">
      {/* Fondo Abstracto "Premium" */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
      <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-20"></div>

      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-[0.2em] mb-1">Plan Activo</p>
          <h3 className="text-2xl font-bold text-white tracking-tight">{plan.name}</h3>
        </div>
        <Icon name="Zap" className="text-yellow-400" size={24} />
      </div>

      <div className="relative z-10 mt-6">
         <div className="flex items-end justify-between">
            <div className="flex gap-4">
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 px-3">
                    <p className="text-[10px] text-gray-400 uppercase">Frecuencia</p>
                    <p className="font-semibold">{plan.schedule?.length || 0}x / Semana</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 px-3">
                     <p className="text-[10px] text-gray-400 uppercase">Estado</p>
                     <div className="flex items-center gap-1">
                         <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                         <span className="font-semibold text-green-400">Activo</span>
                     </div>
                </div>
            </div>
            <div className="text-right">
                <p className="text-3xl font-bold">${plan.price}</p>
                <p className="text-[10px] text-gray-400">Mensual</p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default MyPlanCard;