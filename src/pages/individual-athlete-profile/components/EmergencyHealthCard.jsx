import React from 'react';
import Icon from '../../../components/AppIcon';

const EmergencyHealthCard = ({ athlete, loading = false }) => {

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-muted/50 w-1/2 mb-6 rounded"></div>
        <div className="space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-muted/30 rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  const emergencyName = athlete?.emergency_contact_name?.trim();
  const emergencyPhone = athlete?.emergency_contact_phone?.trim();
  const medicalConditions = athlete?.medical_conditions?.trim();

  const hasName = Boolean(emergencyName);
  const hasPhone = Boolean(emergencyPhone);
  const isComplete = hasName && hasPhone;

  let missingLabel = null;
  if (!hasName && !hasPhone) {
    missingLabel = 'Falta cargar el contacto de emergencia';
  } else if (!hasPhone) {
    missingLabel = 'Falta el teléfono de emergencia';
  } else if (!hasName) {
    missingLabel = 'Falta el nombre del contacto de emergencia';
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-heading font-semibold text-foreground mb-3 md:mb-4">
        Emergencia y Condición Médica
      </h3>

      <div className="grid grid-cols-1 gap-2 md:gap-3">
        <div
          className={`rounded-lg p-3 md:p-4 border ${
            isComplete ? 'bg-muted/30 border-border' : 'bg-error-light border-error/30'
          }`}
        >
          <div className="flex items-start gap-2 md:gap-3">
            <div
              className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isComplete ? '' : 'bg-error-light'
              }`}
              style={isComplete ? { backgroundColor: 'var(--color-error)20' } : undefined}
            >
              <Icon name={isComplete ? 'Phone' : 'AlertTriangle'} size={18} color="var(--color-error)" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm text-muted-foreground">Contacto de emergencia</p>
              {(hasName || hasPhone) && (
                <p className="text-base md:text-lg font-semibold text-foreground">
                  {emergencyName}
                  {hasName && hasPhone && ' · '}
                  {emergencyPhone}
                </p>
              )}
              {missingLabel && (
                <p className="text-sm md:text-base font-semibold text-error">
                  {missingLabel}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-muted/30 border border-border rounded-lg p-3 md:p-4">
          <div className="flex items-start gap-2 md:gap-3">
            <div
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--color-warning)20' }}
            >
              <Icon name="ShieldAlert" size={18} color="var(--color-warning)" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm text-muted-foreground">Condición médica</p>
              {medicalConditions ? (
                <p className="text-sm md:text-base font-medium text-foreground whitespace-pre-line">
                  {medicalConditions}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Ninguna registrada</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyHealthCard;
