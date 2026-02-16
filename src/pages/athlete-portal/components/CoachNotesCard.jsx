import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

// --- UTILS & CONFIG ---

// Función segura para formatear fechas relativas o absolutas
const formatNoteDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) return 'Hoy';
  if (diffDays <= 2) return 'Ayer';
  if (diffDays <= 7) return `Hace ${diffDays} días`;
  
  return new Intl.DateTimeFormat('es-ES', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  }).format(date);
};

// Determina si una nota es "reciente" (menos de 3 días) para ponerle un badge
const isRecent = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) <= 3;
};

// --- SUB-COMPONENTS ---

const NoteItem = ({ note, isLast }) => {
  const isNew = useMemo(() => isRecent(note.date), [note.date]);

  return (
    <div className="relative pl-8 pb-8 last:pb-0 group">
      {/* Línea de tiempo (Connector) */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-[2px] bg-slate-100 group-hover:bg-violet-100 transition-colors duration-300"></div>
      )}

      {/* Avatar / Punto de la línea de tiempo */}
      <div className={`absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 bg-white transition-all duration-300 ${
        isNew ? 'border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : 'border-slate-200'
      }`}>
        {isNew ? (
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-200"></div>
        )}
      </div>

      {/* Tarjeta de la Nota */}
      <div className="bg-slate-50 hover:bg-white rounded-2xl p-5 border border-slate-100 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-1 relative overflow-hidden">
        
        {/* Decoración de fondo sutil */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-violet-500/5 to-transparent rounded-bl-3xl -mr-4 -mt-4 pointer-events-none"></div>

        {/* Header de la nota */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {note.professorName || 'Staff Coach'}
            </span>
            {isNew && (
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-violet-100 text-violet-600 uppercase tracking-widest">
                Nuevo
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {formatNoteDate(note.date)}
          </span>
        </div>

        {/* Contenido */}
        <div className="relative">
          <Icon name="Quote" size={12} className="absolute -top-1 -left-1 text-violet-300 opacity-50" />
          <p className="text-sm leading-relaxed text-slate-600 pl-4 font-medium italic">
            "{note.content}"
          </p>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const CoachNotesCard = ({ notes }) => {
  // Ordenar notas: Más nuevas primero
  const sortedNotes = useMemo(() => {
    if (!notes || !Array.isArray(notes)) return [];
    return [...notes].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [notes]);

  const hasNotes = sortedNotes.length > 0;

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 h-full flex flex-col relative overflow-hidden">
      
      {/* Header Fijo */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <div className="p-2 bg-violet-50 rounded-xl text-violet-600">
              <Icon name="MessageCircle" size={20} />
            </div>
            Feedback <span className="text-violet-600">Hub</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] pl-12 -mt-1">
            Canal directo con el Staff
          </p>
        </div>

        {hasNotes && (
          <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              {sortedNotes.length} Notas
            </span>
          </div>
        )}
      </div>

      {/* Area de Scroll (Feed) */}
      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent hover:scrollbar-thumb-slate-300 -mr-2 pl-1 relative z-10 min-h-[300px] max-h-[400px]">
        {hasNotes ? (
          <div className="pt-2">
            {sortedNotes.map((note, index) => (
              <NoteItem 
                key={index} 
                note={note} 
                isLast={index === sortedNotes.length - 1} 
              />
            ))}
            
            <div className="pl-8 pt-4 pb-2">
                <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    Historial Completo
                </p>
            </div>
          </div>
        ) : (
          /* Empty State Premium */
          <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-dashed border-slate-200">
              <Icon name="MessageSquare" className="text-slate-300" size={24} />
            </div>
            <h4 className="text-slate-900 font-bold text-sm">Sin mensajes aún</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[180px]">
              Tus entrenadores dejarán sus observaciones aquí.
            </p>
          </div>
        )}
      </div>

      {/* Fade inferior para el scroll */}
      {hasNotes && (
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-20"></div>
      )}
    </div>
  );
};

export default CoachNotesCard;