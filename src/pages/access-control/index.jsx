import React, { useState, useEffect, useRef } from 'react';
import { runKioskCheckIn } from '../../services/kiosk';
import { defaultKioskErrorMessage, kioskReasonMessages } from '../../data/kioskReasonMessages';
import Icon from '../../components/AppIcon';
import { featureFlags } from '../../lib/featureFlags';

const AccessControl = () => {
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, warning, denied
  const [message, setMessage] = useState(null);
  const [athleteData, setAthleteData] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const resetToIdle = () => {
    setStatus('idle');
    setIdentifier('');
    setAthleteData(null);
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!identifier) return;
    setStatus('loading');

    try {
      if (!featureFlags.kioskRpcEnabled) {
        throw new Error('Kiosco en modo mantenimiento. Intenta nuevamente en unos minutos.');
      }

      const result = await runKioskCheckIn({ identifier });
      const reasonMessage = kioskReasonMessages[result.reason_code] || result.message || defaultKioskErrorMessage;
      const actorType = result.actorType || (result.coachId ? 'coach' : 'athlete');
      const normalizedUiStatus = (result.uiStatus || '').toUpperCase();

      const resolvedName = result.fullName || result.athleteName || (actorType === 'coach' ? 'Profesor' : 'Atleta');
      const resolvedPlan = actorType === 'coach' ? 'Profesor' : (result.planName || 'Plan');

      setAthleteData({
        name: resolvedName,
        plan: resolvedPlan,
        photo: result.avatarUrl || null,
      });

      if (!result.allowed) {
        setStatus('denied');
        setMessage(result.message || reasonMessage);
        setTimeout(resetToIdle, 4000);
        return;
      }

      const isWarning = normalizedUiStatus === 'WARNING';
      const displayMessage = isWarning
        ? (result.message || 'Acceso permitido con excepción. Pasá por recepción.')
        : actorType === 'coach'
          ? (result.message || 'Acceso permitido.')
          : (typeof result.remaining === 'number'
              ? `Te quedan ${result.remaining} accesos disponibles.`
              : (result.message || reasonMessage));

      setMessage(displayMessage);
      setStatus(isWarning ? 'warning' : 'success');
      setTimeout(resetToIdle, 4000);
    } catch (err) {
      console.error(err);
      setStatus('denied');
      setMessage(err.message || defaultKioskErrorMessage);
      setTimeout(resetToIdle, 4000);
    }
  };

  const handleNumberClick = (num) => {
    if (identifier.length < 11 && status === 'idle') {
      setIdentifier((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    if (status === 'idle') {
      setIdentifier((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (status === 'idle') {
      setIdentifier('');
    }
  };

  const renderKeypad = () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
      <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
        {numbers.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleNumberClick(num.toString())}
            disabled={status !== 'idle'}
            className="h-16 sm:h-20 rounded-2xl bg-white border-2 border-border text-2xl sm:text-3xl font-bold text-foreground shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/5 hover:border-primary/30"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          disabled={status !== 'idle'}
          className="h-16 sm:h-20 rounded-2xl bg-white border-2 border-error/30 text-error font-bold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-error/5 flex items-center justify-center gap-2"
        >
          <Icon name="X" size={20} />
          <span className="text-sm sm:text-base">C</span>
        </button>

        <button
          type="button"
          onClick={() => handleNumberClick('0')}
          disabled={status !== 'idle'}
          className="h-16 sm:h-20 rounded-2xl bg-white border-2 border-border text-2xl sm:text-3xl font-bold text-foreground shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/5 hover:border-primary/30"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          disabled={status !== 'idle'}
          className="h-16 sm:h-20 rounded-2xl bg-white border-2 border-warning/30 text-warning font-bold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-warning/5 flex items-center justify-center"
        >
          <Icon name="Delete" size={24} />
        </button>
      </div>
    );
  };

  const bgClass = status === 'success'
    ? 'bg-gradient-to-br from-green-200/60 via-green-100/40 to-background'
    : status === 'warning'
      ? 'bg-gradient-to-br from-yellow-200/70 via-amber-100/50 to-background'
      : status === 'denied'
        ? 'bg-gradient-to-br from-red-200/60 via-red-100/40 to-background'
        : 'bg-gradient-to-br from-primary/5 via-background to-accent/5';

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 transition-all duration-500 ${bgClass}`}>
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-light shadow-xl mb-6">
            <Icon name="Dumbbell" size={48} color="white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-3">Control de Acceso</h1>
          <p className="text-lg sm:text-xl text-muted-foreground">Ingresá tu DNI o teléfono para validar tu acceso</p>
        </div>

        {(status === 'idle' || status === 'loading') && (
          <form onSubmit={handleCheckIn} className="space-y-6">
            {/* Identifier Display */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value.replace(/\D/g, ''))}
                placeholder="_ _ _ _ _ _ _ _"
                className="w-full text-center text-4xl sm:text-5xl lg:text-6xl font-bold py-6 sm:py-8 rounded-3xl border-4 border-border bg-white shadow-2xl focus:ring-4 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/20 tracking-widest"
                autoFocus
                maxLength={11}
                disabled={status === 'loading'}
                readOnly
              />

              {status === 'loading' && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              )}

              {/* Character Count
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-muted-foreground font-medium">
                {identifier.length} / 11 dígitos
              </div> */}
            </div>

            <div className="pt-8">{renderKeypad()}</div>

            <button
              type="submit"
              disabled={!identifier || status === 'loading'}
              className="w-full h-16 sm:h-20 rounded-2xl bg-gradient-to-r from-primary to-primary-light text-white text-xl sm:text-2xl font-bold shadow-2xl hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-3"
            >
              {status === 'loading' ? (
                <>
                  <div className="animate-spin h-6 w-6 border-3 border-white border-t-transparent rounded-full"></div>
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <Icon name="LogIn" size={24} color="white" />
                  <span>Validar Acceso</span>
                </>
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground">También puedes usar el teclado físico o lector de código de barras</p>
          </form>
        )}

        {(status === 'success' || status === 'warning') && athleteData && (
          <div className="animate-in zoom-in-50 duration-300">
            <div className={`bg-white border-4 rounded-3xl p-8 sm:p-12 shadow-2xl ${status === 'warning' ? 'border-yellow-400' : 'border-success'}`}>
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-6">
                <div className={`w-full h-full rounded-full border-4 p-1 bg-white shadow-xl ${status === 'warning' ? 'border-yellow-400' : 'border-success'}`}>
                  {athleteData.photo ? (
                    <img src={athleteData.photo} alt={athleteData.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center">
                      <Icon name="User" size={60} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className={`absolute -bottom-2 -right-2 w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-4 border-white ${status === 'warning' ? 'bg-yellow-500' : 'bg-success'}`}>
                  <Icon name={status === 'warning' ? 'AlertTriangle' : 'Check'} size={28} color="white" />
                </div>
              </div>

              <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-heading font-bold mb-3 text-center ${status === 'warning' ? 'text-yellow-700' : 'text-foreground'}`}>
                {status === 'warning' ? 'ATENCIÓN' : '¡BIENVENIDO!'}
              </h2>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-6 text-center">{athleteData.name}</p>

              <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full mx-auto mb-8 block w-fit border-2 ${status === 'warning' ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300' : 'bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20'}`}>
                <Icon name="Award" size={20} color={status === 'warning' ? '#a16207' : 'var(--color-primary)'} />
                <span className={`font-bold text-lg ${status === 'warning' ? 'text-yellow-700' : 'text-primary'}`}>{athleteData.plan}</span>
              </div>

              <div className={`border-2 rounded-2xl p-6 mb-6 ${status === 'warning' ? 'bg-yellow-50 border-yellow-300' : 'bg-gradient-to-r from-success/10 to-success/5 border-success/30'}`}>
                <div className={`flex items-center justify-center gap-3 mb-3 ${status === 'warning' ? 'text-yellow-700' : 'text-success'}`}>
                  <Icon name={status === 'warning' ? 'AlertTriangle' : 'CheckCircle'} size={36} />
                  <span className="text-2xl sm:text-3xl font-bold">{status === 'warning' ? 'Acceso con Excepción' : 'Acceso Permitido'}</span>
                </div>
                <p className="text-center text-lg text-foreground font-medium">{message}</p>
              </div>

              <p className="text-center text-muted-foreground text-sm">
                {status === 'warning' ? 'Pasá por recepción para regularizar tu situación.' : '¡Que tengas un excelente entrenamiento! 💪'}
              </p>
            </div>
          </div>
        )}

        {status === 'denied' && (
          <div className="animate-in shake duration-300">
            <div className="bg-white border-4 border-error rounded-3xl p-8 sm:p-12 shadow-2xl">
              <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto bg-gradient-to-br from-error/20 to-error/10 rounded-full flex items-center justify-center mb-6 border-4 border-error/30">
                <Icon name="XOctagon" size={60} className="text-error" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-error mb-6 text-center">ACCESO DENEGADO</h2>

              {athleteData?.name && (
                <p className="text-xl sm:text-2xl text-foreground font-bold text-center mb-4">{athleteData.name}</p>
              )}

              <div className="bg-error/5 border-2 border-error/30 rounded-2xl p-6 mb-6">
                <p className="text-xl sm:text-2xl text-foreground font-bold text-center mb-2">{message}</p>
              </div>

              <div className="bg-muted/30 rounded-2xl p-6 border-2 border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon name="Info" size={24} color="var(--color-primary)" className="flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-foreground mb-2">¿Qué puedes hacer?</p>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div>Dirígete a recepción para resolver el problema</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div>Verifica que hayas ingresado tu DNI o teléfono correctamente</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary"></div>Consulta el estado de tu membresía</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">Powered by <span className="font-bold text-primary">DigitalMatch</span></p>
        </div>
      </div>
    </div>
  );
};

export default AccessControl;
