import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ReportTemplateCard = ({ template, isGenerating, onGenerate }) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-warning/10 text-warning',
    accent: 'bg-accent/10 text-accent',
    success: 'bg-success/10 text-success',
    secondary: 'bg-secondary/10 text-secondary'
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 transition-smooth hover:shadow-lg">
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 ${colorClasses?.[template?.color]} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon name={template?.icon} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-1">{template?.name}</h3>
          <p className="text-sm text-muted-foreground">{template?.description}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Incluye:</p>
        <div className="space-y-1">
          {template?.fields?.slice(0, 3)?.map((field, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-foreground">
              <Icon name="Check" size={12} color="var(--color-success)" />
              <span>{field}</span>
            </div>
          ))}
          {template?.fields?.length > 3 && (
            <p className="text-xs text-muted-foreground ml-5">+{template?.fields?.length - 3} más</p>
          )}
        </div>
      </div>

      <Button
        variant="default"
        size="sm"
        iconName={isGenerating ? 'Loader' : 'Download'}
        onClick={() => onGenerate(template?.id)}
        disabled={isGenerating}
        fullWidth
        loading={isGenerating}
      >
        {isGenerating ? 'Generando...' : 'Generar PDF'}
      </Button>
    </div>
  );
};

export default ReportTemplateCard;