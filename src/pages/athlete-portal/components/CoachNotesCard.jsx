import React from 'react';
import Icon from '../../../components/AppIcon';

const CoachNotesCard = ({ notes }) => {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-semibold text-foreground">Notas del Entrenador</h2>
        <Icon name="MessageSquare" size={24} color="var(--color-accent)" />
      </div>

      {notes && notes?.length > 0 ? (
        <div className="space-y-3">
          {notes?.map((note) => (
            <div key={note?.id} className="p-4 bg-muted/50 rounded-lg border border-border/50">
              <div className="flex items-start gap-3 mb-2">
                <Icon
                  name={note?.type === 'positive' ? 'ThumbsUp' : note?.type === 'improvement' ? 'AlertCircle' : 'MessageSquare'}
                  size={18}
                  color={note?.type === 'positive' ? 'var(--color-success)' : note?.type === 'improvement' ? 'var(--color-warning)' : 'var(--color-accent)'}
                  className="flex-shrink-0 mt-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground mb-2">{note?.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{note?.professorName}</span>
                    <span>•</span>
                    <span>{note?.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="MessageSquare" size={48} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
          <p className="text-muted-foreground">No hay notas del entrenador aún</p>
        </div>
      )}
    </div>
  );
};

export default CoachNotesCard;