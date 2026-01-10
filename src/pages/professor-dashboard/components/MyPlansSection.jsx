import React from 'react';
import Icon from '../../../components/AppIcon';

const MyPlansSection = ({ plans }) => {
  return (
    <div className="space-y-4">
      {plans?.length > 0 ? (
        plans?.map((plan) => (
          <div key={plan?.id} className="bg-card border border-border rounded-xl p-6 transition-smooth hover:shadow-lg">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="Package" size={24} color="var(--color-primary)" />
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-semibold text-foreground mb-1">{plan?.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan?.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Icon name="Users" size={16} color="var(--color-muted-foreground)" />
                    <span className="text-sm text-foreground">
                      {plan?.enrolled}/{plan?.capacity} inscritos
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="DollarSign" size={16} color="var(--color-muted-foreground)" />
                    <span className="text-sm text-foreground">€{plan?.price}/mes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="Calendar" size={16} color="var(--color-muted-foreground)" />
                    <span className="text-sm text-foreground">{plan?.schedule?.length} sesiones/semana</span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Horarios:</p>
                  <div className="flex flex-wrap gap-2">
                    {plan?.schedule?.map((sch, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-muted/50 border border-border/50 rounded-lg text-xs text-foreground"
                      >
                        {sch?.day} {sch?.time}
                      </span>
                    ))}
                  </div>
                </div>

                {plan?.features && plan?.features?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Características:</p>
                    <div className="flex flex-wrap gap-2">
                      {plan?.features?.map((feature, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-success/10 text-success text-xs rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className={`px-3 py-1 rounded-lg text-xs font-medium text-center ${
                  plan?.status === 'active' ?'bg-success/10 text-success' :'bg-muted text-muted-foreground'
                }`}>
                  {plan?.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {Math.round((plan?.enrolled / plan?.capacity) * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Ocupación</div>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Icon name="Package" size={64} color="var(--color-muted-foreground)" className="mx-auto mb-4" />
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">No hay planes asignados</h3>
          <p className="text-muted-foreground">Contacta al administrador para que te asigne planes</p>
        </div>
      )}
    </div>
  );
};

export default MyPlansSection;