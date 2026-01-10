import React from 'react';
import Icon from '../../../components/AppIcon';

const MyPlanCard = ({ plan }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">Mi Plan</h2>
        <Icon name="Package" size={24} color="var(--color-primary)" />
      </div>

      {plan ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-1">{plan?.name}</h3>
            <p className="text-sm text-muted-foreground">{plan?.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Precio Mensual</p>
              <p className="text-lg font-bold text-foreground">€{plan?.price}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Sesiones/Semana</p>
              <p className="text-lg font-bold text-foreground">{plan?.schedule?.length}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Horarios:</p>
            <div className="space-y-2">
              {plan?.schedule?.map((sch, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                  <Icon name="Calendar" size={14} color="var(--color-muted-foreground)" />
                  <span>{sch?.day} - {sch?.time}</span>
                </div>
              ))}
            </div>
          </div>

          {plan?.features && plan?.features?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Incluye:</p>
              <div className="space-y-1">
                {plan?.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-foreground">
                    <Icon name="Check" size={14} color="var(--color-success)" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="Package" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
          <p className="text-muted-foreground">No estás inscrito en ningún plan</p>
        </div>
      )}
    </div>
  );
};

export default MyPlanCard;