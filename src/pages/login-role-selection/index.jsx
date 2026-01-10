import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';

const LoginRoleSelection = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const demoUsers = [
  {
    role: 'admin',
    username: 'admin@digitalmatch.com',
    password: 'admin123',
    name: 'Administrador Sistema',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_10fa66223-1763296776467.png",
    avatarAlt: 'Retrato profesional de administrador con traje formal'
  },
  {
    role: 'profesor',
    username: 'profesor@digitalmatch.com',
    password: 'profesor123',
    name: 'Ana García',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_118427f75-1763294329565.png",
    avatarAlt: 'Retrato profesional de profesora con ropa deportiva'
  },
  {
    role: 'atleta',
    username: 'atleta@digitalmatch.com',
    password: 'atleta123',
    name: 'Carlos Rodríguez',
    avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_14ecadb88-1763292065925.png",
    avatarAlt: 'Retrato profesional de atleta con camiseta deportiva roja'
  }];


  const handleInputChange = (e) => {
    const { name, value } = e?.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const user = demoUsers?.find(
        (u) => u?.username === formData?.username && u?.password === formData?.password
      );

      if (user) {
        login({
          id: `USER-${Date.now()}`,
          name: user?.name,
          email: user?.username,
          role: user?.role,
          avatar: user?.avatar,
          avatarAlt: user?.avatarAlt
        });

        const redirectPaths = {
          admin: '/main-dashboard',
          profesor: '/professor-dashboard',
          atleta: '/athlete-portal'
        };

        navigate(redirectPaths?.[user?.role] || '/main-dashboard');
      } else {
        setError('Credenciales incorrectas. Usa las cuentas demo.');
      }
      setIsLoading(false);
    }, 800);
  };

  const handleDemoLogin = (demoUser) => {
    setIsLoading(true);
    setTimeout(() => {
      login({
        id: `USER-${Date.now()}`,
        name: demoUser?.name,
        email: demoUser?.username,
        role: demoUser?.role,
        avatar: demoUser?.avatar,
        avatarAlt: demoUser?.avatarAlt
      });

      const redirectPaths = {
        admin: '/main-dashboard',
        profesor: '/professor-dashboard',
        atleta: '/athlete-portal'
      };

      navigate(redirectPaths?.[demoUser?.role] || '/main-dashboard');
    }, 500);
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

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">
                  Rol
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData?.role}
                  onChange={handleInputChange}
                  className="w-full h-10 px-4 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-smooth">

                  <option value="admin">Administrador</option>
                  <option value="profesor">Profesor/Instructor</option>
                  <option value="atleta">Atleta/Alumno</option>
                </select>
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

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground text-center mb-4">Cuentas Demo para Pruebas</p>
              <div className="space-y-3">
                {demoUsers?.map((user) =>
                <button
                  key={user?.role}
                  onClick={() => handleDemoLogin(user)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-3 bg-muted/50 hover:bg-muted rounded-lg transition-smooth border border-border/50 hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed">

                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Icon
                      name={user?.role === 'admin' ? 'Shield' : user?.role === 'profesor' ? 'GraduationCap' : 'User'}
                      size={20}
                      color="var(--color-primary)" />

                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-foreground">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.username}</p>
                    </div>
                    <div className="px-2 py-1 bg-primary/10 rounded text-xs font-medium text-primary capitalize">
                      {user?.role}
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Sistema de demostración con datos simulados
            </p>
          </div>
        </div>
      </div>
    </>);

};

export default LoginRoleSelection;