import React from 'react';
import Icon from '../../../components/AppIcon';

const UpcomingSessionsCard = ({ sessions }) => {
  const hasSessions = sessions && sessions.length > 0;

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Icon name="Clock" className="text-slate-900" size={20} />
          Agenda
        </h2>
        {hasSessions && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        )}
      </div>

      {hasSessions ? (
        <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 pb-2">
          {sessions.map((session, idx) => (
            <div key={idx} className="relative pl-6">
              {/* Timeline Dot */}
              <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${idx === 0 ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'}`}></div>
              
              <div className="flex flex-col">
                <span className={`text-xs font-bold uppercase mb-1 ${idx === 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                    {session.date} • {session.time}
                </span>
                <h3 className={`font-bold text-slate-800 ${idx === 0 ? 'text-lg' : 'text-sm'}`}>
                    {session.type}
                </h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Icon name="MapPin" size={10} /> {session.location}
                </p>
                {idx === 0 && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                        <Icon name="User" size={12} />
                        Coach {session.professor}
                    </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
           <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
               <Icon name="Coffee" size={20} className="text-slate-400" />
           </div>
           <p className="text-slate-900 font-bold text-sm">Día de Descanso</p>
           <p className="text-slate-400 text-xs mt-1 max-w-[150px]">La recuperación es parte del entrenamiento.</p>
        </div>
      )}
    </div>
  );
};

export default UpcomingSessionsCard;