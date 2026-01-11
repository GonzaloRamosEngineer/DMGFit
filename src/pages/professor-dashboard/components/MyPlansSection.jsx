import React from 'react';
import Icon from '../../../components/AppIcon';

const MyPlansSection = ({ plans }) => {
  if (!plans || plans.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Icon name="Package" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No hay planes activos</h3>
        <p className="text-muted-foreground">Actualmente no tienes planes asignados o activos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <div key={plan.id} className="bg-card border border-border rounded-xl p-6 transition-smooth hover:shadow-lg">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            {/* Header del Plan */}
            <div className="flex items-start gap-4 flex-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name="Package" size={24} color="var(--color-primary)" />
              </div>
              <div>
                <h3 className="text-xl font-heading font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan.description || 'Sin descripción'}</p>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:flex gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="Users" size={16} />
                    <span className="text-foreground">{plan.enrolled || 0} / {plan.capacity}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon name="DollarSign" size={16} />
                    <span className="text-foreground">€{plan.price || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ocupación Radial */}
            <div className="flex flex-col items-center justify-center min-w-[100px]">
              <div className="text-2xl font-bold text-primary">
                {plan.capacity > 0 ? Math.round((plan.enrolled / plan.capacity) * 100) : 0}%
              </div>
              <span className="text-xs text-muted-foreground">Ocupación</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyPlansSection;