import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Icon from '../../components/AppIcon';

const AccessControl = () => {
  const [dni, setDni] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState(null);
  const [athleteData, setAthleteData] = useState(null);
  const inputRef = useRef(null);

  // Auto-focus para que siempre esté listo para escribir (o lector de barras)
  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const handleCheckIn = async (e) => {
    e.preventDefault();
    if (!dni) return;
    setStatus('loading');

    try {
      // 1. Buscar Atleta por DNI
      const { data: athlete, error: athError } = await supabase
        .from('athletes')
        .select(`
          id, status, 
          profiles:profile_id(full_name, avatar_url),
          plans:plan_id(name, access_limit), 
          payments(payment_date, status)
        `)
        .eq('dni', dni)
        .single();

      if (athError || !athlete) throw new Error("Atleta no encontrado");

      // 2. Validar Estado General
      if (athlete.status !== 'active') throw new Error("Atleta INACTIVO. Consulte en administración.");

      // 3. Calcular Período
      const lastPayment = athlete.payments
        ?.filter(p => p.status === 'paid')
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

      const cycleStartDate = lastPayment ? new Date(lastPayment.payment_date) : new Date(new Date().setDate(new Date().getDate() - 30));
      
      const expirationDate = new Date(cycleStartDate);
      expirationDate.setDate(expirationDate.getDate() + 30);

      if (new Date() > expirationDate) throw new Error("Cuota VENCIDA. Por favor regularice su pago.");

      // 4. Contar Accesos en este ciclo
      const { count, error: countError } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('athlete_id', athlete.id)
        .gte('check_in_time', cycleStartDate.toISOString());

      // 5. Lógica de Plan
      const limit = athlete.plans?.access_limit;
      const planName = athlete.plans?.name || "Plan Sin Nombre";
      let displayMessage = "";

      if (limit) {
        const remaining = limit - count;
        if (remaining <= 0) throw new Error(`Sin accesos restantes. Límite: ${limit}.`);
        displayMessage = `Te quedan ${remaining - 1} accesos hasta el ${expirationDate.toLocaleDateString()}`; 
      } else {
        displayMessage = `Pase Libre activo hasta el ${expirationDate.toLocaleDateString()}`;
      }

      // 6. Registrar Acceso Exitoso
      await supabase.from('access_logs').insert({
        athlete_id: athlete.id,
        access_granted: true
      });

      // ÉXITO VISUAL
      setAthleteData({
        name: athlete.profiles.full_name,
        plan: planName,
        photo: athlete.profiles.avatar_url
      });
      setMessage(displayMessage);
      setStatus('success');

      setTimeout(() => {
        setStatus('idle');
        setDni('');
        setAthleteData(null);
      }, 4000);

    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message);

      setTimeout(() => {
        setStatus('idle');
        setDni('');
      }, 4000);
    }
  };

  // Funciones del teclado numérico
  const handleNumberClick = (num) => {
    if (dni.length < 10 && status === 'idle') {
      setDni(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    if (status === 'idle') {
      setDni(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (status === 'idle') {
      setDni('');
    }
  };

  // Renderizar teclado numérico
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
        
        {/* Clear button */}
        <button
          type="button"
          onClick={handleClear}
          disabled={status !== 'idle'}
          className="h-16 sm:h-20 rounded-2xl bg-white border-2 border-error/30 text-error font-bold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-error/5 flex items-center justify-center gap-2"
        >
          <Icon name="X" size={20} />
          <span className="text-sm sm:text-base">C</span>
        </button>
        
        {/* Zero button */}
        <button
          type="button"
          onClick={() => handleNumberClick('0')}
          disabled={status !== 'idle'}
          className="h-16 sm:h-20 rounded-2xl bg-white border-2 border-border text-2xl sm:text-3xl font-bold text-foreground shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/5 hover:border-primary/30"
        >
          0
        </button>
        
        {/* Backspace button */}
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

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 transition-all duration-500 ${
      status === 'success' ? 'bg-gradient-to-br from-success/10 via-success/5 to-background' : 
      status === 'error' ? 'bg-gradient-to-br from-error/10 via-error/5 to-background' : 
      'bg-gradient-to-br from-primary/5 via-background to-accent/5'
    }`}>
      <div className="w-full max-w-3xl">
        
        {/* Logo / Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-light shadow-xl mb-6">
            <Icon name="Dumbbell" size={48} color="white" />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-3">
            Control de Acceso
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Ingresa tu DNI para validar tu acceso
          </p>
        </div>

        {/* Input Display & Keypad */}
        {status === 'idle' || status === 'loading' ? (
          <form onSubmit={handleCheckIn} className="space-y-6">
            {/* DNI Display */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                placeholder="_ _ _ _ _ _ _ _"
                className="w-full text-center text-4xl sm:text-5xl lg:text-6xl font-bold py-6 sm:py-8 rounded-3xl border-4 border-border bg-white shadow-2xl focus:ring-4 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/20 tracking-widest"
                autoFocus
                maxLength={10}
                disabled={status === 'loading'}
                readOnly
              />
              
              {/* Loading Spinner */}
              {status === 'loading' && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2">
                  <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </div>
              )}

              {/* Character Count
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-muted-foreground font-medium">
                {dni.length} / 10 dígitos
              </div> */}
            </div>

            {/* Numeric Keypad */}
            <div className="pt-8">
              {renderKeypad()}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!dni || status === 'loading'}
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

            {/* Helper Text */}
            <p className="text-center text-sm text-muted-foreground">
              También puedes usar el teclado físico o lector de código de barras
            </p>
          </form>
        ) : null}

        {/* Success Screen */}
        {status === 'success' && athleteData && (
          <div className="animate-in zoom-in-50 duration-300">
            <div className="bg-white border-4 border-success rounded-3xl p-8 sm:p-12 shadow-2xl">
              {/* Avatar */}
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto mb-6">
                <div className="w-full h-full rounded-full border-4 border-success p-1 bg-white shadow-xl">
                  {athleteData.photo ? 
                    <img 
                      src={athleteData.photo} 
                      alt={athleteData.name}
                      className="w-full h-full rounded-full object-cover" 
                    /> :
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 rounded-full flex items-center justify-center">
                      <Icon name="User" size={60} className="text-muted-foreground" />
                    </div>
                  }
                </div>
                {/* Success Badge */}
                <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-success rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                  <Icon name="Check" size={28} color="white" />
                </div>
              </div>

              {/* Welcome Message */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold text-foreground mb-3 text-center">
                ¡Bienvenido!
              </h2>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-6 text-center">
                {athleteData.name}
              </p>

              {/* Plan Badge */}
              <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20 mx-auto mb-8 block w-fit">
                <Icon name="Award" size={20} color="var(--color-primary)" />
                <span className="font-bold text-lg text-primary">{athleteData.plan}</span>
              </div>

              {/* Access Granted */}
              <div className="bg-gradient-to-r from-success/10 to-success/5 border-2 border-success/30 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-center gap-3 text-success mb-3">
                  <Icon name="CheckCircle" size={36} />
                  <span className="text-2xl sm:text-3xl font-bold">Acceso Permitido</span>
                </div>
                <p className="text-center text-lg text-foreground font-medium">
                  {message}
                </p>
              </div>

              {/* Footer */}
              <p className="text-center text-muted-foreground text-sm">
                ¡Que tengas un excelente entrenamiento! 💪
              </p>
            </div>
          </div>
        )}

        {/* Error Screen */}
        {status === 'error' && (
          <div className="animate-in shake duration-300">
            <div className="bg-white border-4 border-error rounded-3xl p-8 sm:p-12 shadow-2xl">
              {/* Error Icon */}
              <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto bg-gradient-to-br from-error/20 to-error/10 rounded-full flex items-center justify-center mb-6 border-4 border-error/30">
                <Icon name="XOctagon" size={60} className="text-error" />
              </div>

              {/* Error Title */}
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-error mb-6 text-center">
                Acceso Denegado
              </h2>

              {/* Error Message */}
              <div className="bg-error/5 border-2 border-error/30 rounded-2xl p-6 mb-6">
                <p className="text-xl sm:text-2xl text-foreground font-bold text-center mb-2">
                  {message}
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-muted/30 rounded-2xl p-6 border-2 border-border">
                <div className="flex items-start gap-3 mb-3">
                  <Icon name="Info" size={24} color="var(--color-primary)" className="flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold text-foreground mb-2">¿Qué puedes hacer?</p>
                    <ul className="space-y-2 text-muted-foreground text-sm">
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        Dirígete a recepción para resolver el problema
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        Verifica que hayas ingresado tu DNI correctamente
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        Consulta el estado de tu membresía
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-bold text-primary">DigitalMatch</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccessControl;