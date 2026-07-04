import React from 'react';
import Icon from '../../../components/AppIcon';

const MyPlansSection = ({ plans }) => {
  if (!plans || plans.length === 0) {
    return (
      <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-sm">
        <Icon name="Package" size={40} className="mx-auto mb-3 text-text-tertiary" />
        <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest">Sin planes asignados</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6">
         <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Icon name="Layers" size={20} />
         </div>
         <h3 className="font-black text-text-primary text-sm uppercase tracking-widest">Mis Planes</h3>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => {
          const occupancy = plan.capacity > 0 ? Math.round((plan.enrolled / plan.capacity) * 100) : 0;
          const isFull = occupancy >= 100;

          return (
            <div key={plan.id} className="group p-4 rounded-2xl border border-border hover:border-purple-200 hover:shadow-md transition-all bg-muted/50 hover:bg-card">

              {/* Header Plan */}
              <div className="flex justify-between items-start mb-3">
                 <div>
                    <h4 className="font-bold text-text-primary text-sm">{plan.name}</h4>
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wide mt-0.5">
                       ${plan.price?.toLocaleString()} / mes
                    </p>
                 </div>
                 {isFull && (
                    <span className="px-2 py-0.5 bg-error-light text-error text-[10px] font-black uppercase rounded-md tracking-wider">
                       Full
                    </span>
                 )}
              </div>

              {/* Occupancy Bar */}
              <div>
                 <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-bold text-text-secondary">Inscritos</span>
                    <span className="font-black text-text-primary">{plan.enrolled} <span className="text-text-tertiary font-medium">/ {plan.capacity}</span></span>
                 </div>
                 <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                         isFull ? 'bg-rose-500' : occupancy > 80 ? 'bg-amber-500' : 'bg-purple-600'
                      }`}
                      style={{ width: `${Math.min(100, occupancy)}%` }}
                    ></div>
                 </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyPlansSection;