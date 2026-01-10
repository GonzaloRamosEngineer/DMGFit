import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ExportHistoryCard = ({ history }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-foreground">Historial de Exportaciones</h3>
        <Icon name="History" size={20} color="var(--color-muted-foreground)" />
      </div>

      {history && history?.length > 0 ? (
        <div className="space-y-3">
          {history?.map((item) => (
            <div key={item?.id} className="p-4 bg-muted/50 rounded-lg border border-border/50 transition-smooth hover:bg-muted">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon name="FileText" size={20} color="var(--color-success)" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate mb-1">{item?.fileName}</p>
                  <p className="text-xs text-muted-foreground mb-2">{item?.template}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Icon name="Calendar" size={12} />
                      <span>{item?.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon name="HardDrive" size={12} />
                      <span>{item?.size}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Download"
                  fullWidth
                >
                  Descargar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Share2"
                >
                  <Icon name="Share2" size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="FileText" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
          <p className="text-muted-foreground">No hay exportaciones recientes</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          iconName="Archive"
          fullWidth
        >
          Ver Historial Completo
        </Button>
      </div>
    </div>
  );
};

export default ExportHistoryCard;