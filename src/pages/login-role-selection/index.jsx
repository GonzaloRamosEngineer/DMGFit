import React, { useState } from 'react'; // Eliminamos useEffect
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';

const LoginRoleSelection = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); // Ya no necesitamos isAuthenticated ni currentUser aquí
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setIsLoading(true);
    setError('');

    console.log("🖱️ Botón presionado. Intentando login...");

    try {
      const { error: loginError, user } = await login({
        email: formData?.username,
        password: formData?.password
      });

      console.log("🔄 Respuesta de login recibida:", { loginError, user });

      if (loginError) {
        // ... (resto de tu lógica de error igual que antes) ...
        setIsLoading(false);
        return;
      }

      // ... (resto de lógica de redirección) ...
      const redirectPaths = {
        admin: '/main-dashboard',
        profesor: '/professor-dashboard',
        atleta: '/athlete-portal'
      };

      const userRole = user?.role || 'atleta';
      const targetPath = redirectPaths[userRole] || '/main-dashboard';

      console.log('🚀 Redirigiendo a:', targetPath);
      navigate(targetPath, { replace: true });

    } catch (err) {
      console.error('❌ Login failed (Catch):', err);
      setError('Ocurrió un error inesperado.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Login - DigitalMatch</title>
      </Helmet>
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-pulse" style={{ animationDuration: '8s' }}></div>
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4 shadow-glow-primary">
              <Icon name="Dumbbell" size={32} color="#FFFFFF" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">DigitalMatch</h1>
            <p className="text-muted-foreground">Plataforma de Gestión Deportiva</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-8 shadow-lg backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-foreground mb-2">
                  Usuario / Email
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={formData?.username}
                  onChange={handleInputChange}
                  placeholder="usuario@digitalmatch.com"
                  className="w-full"
                  required />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData?.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full pr-12"
                    required />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-smooth">
                    <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={20} />
                  </button>
                </div>
              </div>

              {error &&
                <div className="bg-error/10 border border-error/20 rounded-lg p-3 flex items-start gap-2">
                  <Icon name="AlertCircle" size={20} color="var(--color-error)" className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{error}</p>
                </div>
              }

              <Button
                type="submit"
                variant="default"
                size="lg"
                fullWidth
                loading={isLoading}
                iconName="LogIn">
                Iniciar Sesión
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRoleSelection;