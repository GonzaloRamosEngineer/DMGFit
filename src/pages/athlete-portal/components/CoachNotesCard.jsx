import React from 'react';
import Icon from '../../../components/AppIcon';

const CoachNotesCard = ({ notes }) => {
  const latestNote = notes && notes.length > 0 ? notes[0] : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Icon name="MessageCircle" className="text-purple-500" size={20} />
            Feedback del Staff
        </h2>
      </div>

      {latestNote ? (
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 relative">
            {/* Icono de cita */}
            <Icon name="Quote" size={24} className="absolute top-4 right-4 text-purple-200" />
            
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 font-bold">
                    {latestNote.professorName?.charAt(0) || 'C'}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-900">{latestNote.professorName}</p>
                    <p className="text-xs text-purple-600 font-medium">{latestNote.date}</p>
                </div>
            </div>
            
            <p className="text-gray-700 text-sm leading-relaxed italic">
                "{latestNote.content}"
            </p>

            {notes.length > 1 && (
                <div className="mt-4 pt-3 border-t border-purple-100 text-center">
                    <button className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors">
                        Ver {notes.length - 1} notas anteriores
                    </button>
                </div>
            )}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-400 text-sm">
            <p>Sin notas recientes.</p>
        </div>
      )}
    </div>
  );
};

export default CoachNotesCard;