import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient'; // Necesitamos acceso directo para signUp

const LoginRoleSelection = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Estado para alternar entre Login y Registro
  const [isLoginMode, setIsLoginMode] = useState(true); 

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '' // Solo para registro
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isLoginMode) {
        // --- MODO LOGIN (Existente) ---
        const { error: loginError, user } = await login({
          email: formData.email,
          password: formData.password
        });

        if (loginError) throw loginError;

        // Redirección inteligente
        const redirectPaths = {
          admin: '/main-dashboard',
          profesor: '/professor-dashboard',
          atleta: '/athlete-portal'
        };
        const targetPath = redirectPaths[user?.role] || '/athlete-portal'; // Default a atleta si no hay rol claro
        navigate(targetPath, { replace: true });

      } else {
        // --- MODO REGISTRO (Nuevo) ---
        // Esto crea el usuario en auth.users y dispara el Trigger que conecta con la ficha
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName, // Se guarda en metadata
              role: 'atleta' // Por defecto
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          setSuccessMessage('¡Cuenta activada con éxito! Ya puedes iniciar sesión.');
          setIsLoginMode(true); // Volver al login automáticamente
          setFormData(prev => ({ ...prev, password: '' })); // Limpiar pass
        }
      }

    } catch (err) {
      console.error('Operation failed:', err);
      // Mensajes amigables
      if (err.message.includes('Invalid login credentials')) {
        setError('Usuario o contraseña incorrectos.');
      } else if (err.message.includes('User already registered')) {
        setError('Este email ya está registrado. Intenta iniciar sesión.');
      } else {
        setError(err.message || 'Ocurrió un error inesperado.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{isLoginMode ? 'Iniciar Sesión' : 'Activar Cuenta'} - DigitalMatch</title>
      </Helmet>
      
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Fondo animado */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-pulse" style={{ animationDuration: '8s' }}></div>
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4 shadow-glow-primary transition-transform hover:scale-105">
              <Icon name="Dumbbell" size={32} color="#FFFFFF" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">DigitalMatch</h1>
            <p className="text-muted-foreground">Plataforma de Gestión Deportiva</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-8 shadow-lg backdrop-blur-sm">
            
            {/* Toggle Tabs */}
            <div className="flex p-1 bg-muted/50 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => { setIsLoginMode(true); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  isLoginMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => { setIsLoginMode(false); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  !isLoginMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Activar Cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {!isLoginMode && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
                    Nombre Completo
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Tu nombre"
                    required={!isLoginMode}
                    className="w-full"
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="usuario@digitalmatch.com"
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Contraseña { !isLoginMode && <span className="text-xs text-muted-foreground">(Usa tu DNI si es tu primera vez)</span> }
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full pr-12"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth"
                  >
                    <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={20} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-error/10 border border-error/20 rounded-lg p-3 flex items-start gap-2 animate-in fade-in">
                  <Icon name="AlertCircle" size={20} color="var(--color-error)" className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              {successMessage && (
                <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-start gap-2 animate-in fade-in">
                  <Icon name="CheckCircle" size={20} color="var(--color-success)" className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-success">{successMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                size="lg"
                fullWidth
                loading={isLoading}
                iconName={isLoginMode ? "LogIn" : "UserPlus"}
              >
                {isLoginMode ? 'Ingresar' : 'Registrarme'}
              </Button>
            </form>

            {isLoginMode && (
              <div className="mt-6 text-center">
                <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRoleSelection;