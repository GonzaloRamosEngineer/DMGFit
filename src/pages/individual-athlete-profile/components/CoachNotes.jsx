import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const CoachNotes = ({ notes, onAddNote }) => {
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNote = () => {
    if (newNote?.trim()) {
      onAddNote(newNote);
      setNewNote('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-heading font-semibold text-foreground">
          Notas del Entrenador
        </h3>
        <Button
          variant="outline"
          size="sm"
          iconName="Plus"
          iconPosition="left"
          onClick={() => setIsAdding(!isAdding)}
        >
          Nueva
        </Button>
      </div>
      {isAdding && (
        <div className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <Input
            type="text"
            placeholder="Escribe una nota..."
            value={newNote}
            onChange={(e) => setNewNote(e?.target?.value)}
            className="mb-3"
          />
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote?.trim()}
            >
              Guardar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2 md:space-y-3 max-h-96 overflow-y-auto">
        {notes?.length === 0 ? (
          <div className="text-center py-6 md:py-8 text-muted-foreground">
            <Icon name="FileText" size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm md:text-base">No hay notas registradas</p>
          </div>
        ) : (
          notes?.map((note) => (
            <div 
              key={note?.id}
              className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 transition-smooth hover:bg-muted/50"
            >
              <div className="flex items-start gap-2 md:gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon name="User" size={16} color="var(--color-primary)" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-foreground mb-1">
                    {note?.author}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {note?.timestamp}
                  </p>
                </div>
              </div>
              <p className="text-sm md:text-base text-foreground leading-relaxed">
                {note?.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CoachNotes;