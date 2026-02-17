import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | success | error
  const [message, setMessage] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    setMessage('');

    // URL a la que volverá el usuario para poner la nueva contraseña
    const redirectTo = `${window.location.origin}/update-password`;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });

      if (error) throw error;

      setStatus('success');
      setMessage('¡Enlace enviado! Revisa tu correo (y spam) para continuar.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Recuperar Contraseña - VC Fit</title></Helmet>
      
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-stone-50">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />
        
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/85 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-2xl p-8">
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-stone-100 text-stone-600">
                <Icon name="Key" size={28} />
              </div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Recuperar Acceso</h1>
              <p className="text-stone-500 text-sm mt-2">
                Ingresa tu email y te enviaremos un enlace mágico.
              </p>
            </div>

            {status === 'success' ? (
              <div className="text-center animate-in fade-in space-y-6">
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-sm font-medium">
                  {message}
                </div>
                <Link to="/" className="block">
                  <Button variant="outline" fullWidth>Volver al Login</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-2 tracking-widest uppercase">Email Registrado</label>
                  <Input
                    type="email"
                    placeholder="ejemplo@vcfit.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                {status === 'error' && (
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100">
                    {message}
                  </div>
                )}

                <Button 
                  type="submit" 
                  variant="default" 
                  fullWidth 
                  size="lg" 
                  loading={loading}
                  iconName="Send"
                >
                  Enviar Enlace
                </Button>

                <div className="text-center pt-2">
                  <Link to="/" className="text-xs font-bold text-stone-400 hover:text-stone-600 uppercase tracking-widest transition-colors">
                    Cancelar y Volver
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;