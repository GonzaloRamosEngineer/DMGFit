import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Verificamos sesión al montar. 
  // Supabase hace login automático al hacer click en el link del email.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Si el link expiró o es inválido
        navigate('/forgot-password');
      }
    });
  }, [navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      alert('Error: ' + error.message);
      setLoading(false);
    } else {
      // Éxito total
      alert('¡Contraseña actualizada! Redirigiendo...');
      navigate('/'); 
    }
  };

  return (
    <>
      <Helmet><title>Nueva Contraseña - VC Fit</title></Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-stone-50">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />

        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/85 backdrop-blur-2xl border border-white/60 rounded-[2rem] shadow-2xl p-8">
            
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-stone-900 text-white">
                <Icon name="ShieldCheck" size={28} />
              </div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Nueva Contraseña</h1>
              <p className="text-stone-500 text-sm mt-2">
                Crea una contraseña segura para tu cuenta.
              </p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2 tracking-widest uppercase">Nueva Clave</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full tracking-widest"
                />
              </div>

              <Button 
                type="submit" 
                variant="default" 
                fullWidth 
                size="lg" 
                loading={loading}
                iconName="Check"
              >
                Actualizar y Entrar
              </Button>
            </form>

          </div>
        </div>
      </div>
    </>
  );
};

export default UpdatePassword;