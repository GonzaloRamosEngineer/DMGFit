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

      // 3. Calcular Período (Desde el último pago aprobado)
      // Tomamos el último pago 'paid' para definir el inicio del ciclo
      const lastPayment = athlete.payments
        ?.filter(p => p.status === 'paid')
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];

      const cycleStartDate = lastPayment ? new Date(lastPayment.payment_date) : new Date(new Date().setDate(new Date().getDate() - 30)); // Fallback 30 días
      
      // Fecha de vencimiento (asumimos 30 días desde el pago)
      const expirationDate = new Date(cycleStartDate);
      expirationDate.setDate(expirationDate.getDate() + 30);

      // Verificar si ya venció la cuota
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
        // Plan Limitado
        const remaining = limit - count;
        if (remaining <= 0) throw new Error(`Sin accesos restantes. Límite: ${limit}.`);
        displayMessage = `Te quedan ${remaining - 1} accesos hasta el ${expirationDate.toLocaleDateString()}`; 
        // -1 porque estamos a punto de consumir uno ahora
      } else {
        // Plan Libre
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

      // Reset automático a los 4 segundos
      setTimeout(() => {
        setStatus('idle');
        setDni('');
        setAthleteData(null);
      }, 4000);

    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.message);
      
      // Registrar intento fallido (opcional)
      // await supabase.from('access_logs').insert({ rejection_reason: err.message, access_granted: false ... });

      setTimeout(() => {
        setStatus('idle');
        setDni('');
      }, 4000);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${
      status === 'success' ? 'bg-success/20' : status === 'error' ? 'bg-error/20' : 'bg-background'
    }`}>
      <div className="w-full max-w-2xl text-center space-y-8">
        
        {/* Logo / Header */}
        <div className="mb-8">
          <Icon name="Dumbbell" size={60} className="mx-auto mb-4 text-primary" />
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground">Control de Acceso</h1>
          <p className="text-xl text-muted-foreground mt-2">Ingresa tu DNI para entrar</p>
        </div>

        {/* Input Gigante */}
        {status === 'idle' || status === 'loading' ? (
          <form onSubmit={handleCheckIn} className="relative max-w-lg mx-auto">
            <input
              ref={inputRef}
              type="text" // text para evitar flechitas de número, pero validamos numérico
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))} // Solo números
              placeholder="Ej: 12345678"
              className="w-full text-center text-4xl md:text-5xl font-bold py-6 rounded-2xl border-2 border-border bg-card shadow-lg focus:ring-4 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-muted/20"
              autoFocus
              maxLength={10}
              disabled={status === 'loading'}
            />
            {status === 'loading' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
          </form>
        ) : null}

        {/* Resultados */}
        {status === 'success' && athleteData && (
          <div className="animate-in zoom-in-50 duration-300 bg-card border border-success/30 rounded-2xl p-8 shadow-2xl shadow-success/20">
            <div className="w-32 h-32 mx-auto rounded-full border-4 border-success p-1 mb-6">
               {athleteData.photo ? 
                 <img src={athleteData.photo} className="w-full h-full rounded-full object-cover" /> :
                 <div className="w-full h-full bg-muted rounded-full flex items-center justify-center"><Icon name="User" size={48} /></div>
               }
            </div>
            <h2 className="text-4xl font-bold text-foreground mb-2">¡Hola, {athleteData.name}!</h2>
            <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary font-bold text-lg mb-6">
              {athleteData.plan}
            </div>
            <div className="text-2xl font-medium text-success">
              <Icon name="CheckCircle" size={32} className="inline mr-2 -mt-1" />
              Acceso Permitido
            </div>
            <p className="text-lg text-muted-foreground mt-4 border-t border-border pt-4">
              {message}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-in shake duration-300 bg-card border border-error/30 rounded-2xl p-8 shadow-2xl shadow-error/20">
            <div className="w-24 h-24 mx-auto bg-error/10 rounded-full flex items-center justify-center mb-6 text-error">
              <Icon name="XOctagon" size={48} />
            </div>
            <h2 className="text-3xl font-bold text-error mb-4">Acceso Denegado</h2>
            <p className="text-xl text-foreground font-medium">
              {message}
            </p>
            <p className="text-muted-foreground mt-4">
              Por favor, diríjase a recepción.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default AccessControl;