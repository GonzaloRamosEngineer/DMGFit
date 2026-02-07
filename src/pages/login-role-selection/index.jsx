import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const LoginRoleSelection = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Estado para alternar entre Login y Registro
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uiStatus, setUiStatus] = useState('idle'); // idle | checking | success | error
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // --- UI: Tilt + Glow (sin dependencias) ---
  const cardRef = useRef(null);
  const rafRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 40 });

  const title = useMemo(() => (isLoginMode ? 'Iniciar Sesión' : 'Activar Cuenta'), [isLoginMode]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;  // 0..1
    const py = (e.clientY - rect.top) / rect.height;  // 0..1

    // Glow follows mouse, clamp
    const gx = Math.max(0, Math.min(100, px * 100));
    const gy = Math.max(0, Math.min(100, py * 100));

    // Tilt effect
    const max = 6; // degrees
    const ry = (px - 0.5) * (max * 2);
    const rx = (0.5 - py) * (max * 2);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setGlow({ x: gx, y: gy });
      setTilt({ rx, ry });
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0 });
    setGlow({ x: 50, y: 40 });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
    setSuccessMessage('');
  };

  const redirectByRole = (role) => {
    const redirectPaths = {
      admin: '/main-dashboard',
      profesor: '/professor-dashboard',
      atleta: '/athlete-portal'
    };
    return redirectPaths[role] || '/athlete-portal';
  };

  const friendlyError = (err) => {
    const msg = err?.message || 'Ocurrió un error inesperado.';
    if (msg.includes('Invalid login credentials')) return 'Usuario o contraseña incorrectos.';
    if (msg.includes('User already registered')) return 'Este email ya está registrado. Intenta iniciar sesión.';
    if (msg.toLowerCase().includes('password')) return 'Revisá la contraseña (mínimo 6 caracteres).';
    return msg;
  };

  const handleResetPassword = async () => {
    setError('');
    setSuccessMessage('');

    const email = (formData.email || '').trim();
    if (!email) {
      setError('Ingresá tu email para poder enviarte el link de recuperación.');
      return;
    }

    try {
      setUiStatus('checking');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (resetError) throw resetError;

      setUiStatus('success');
      setSuccessMessage('Te enviamos un correo para recuperar el acceso. Revisa tu bandeja de entrada.');
      setTimeout(() => setUiStatus('idle'), 900);
    } catch (err) {
      setUiStatus('error');
      setError(friendlyError(err));
      setTimeout(() => setUiStatus('idle'), 900);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setUiStatus('checking');
    setError('');
    setSuccessMessage('');

    try {
      if (isLoginMode) {
        // --- MODO LOGIN ---
        const { error: loginError, user } = await login({
          email: formData.email,
          password: formData.password
        });

        if (loginError) throw loginError;

        setUiStatus('success');

        // Redirección inteligente
        const targetPath = redirectByRole(user?.role);
        setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, 450);

      } else {
        // --- MODO REGISTRO (Activación controlada / por defecto atleta) ---
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: 'atleta'
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data?.user) {
          setUiStatus('success');
          setSuccessMessage('¡Cuenta activada con éxito! Ya podés iniciar sesión.');
          setIsLoginMode(true);
          setFormData((prev) => ({ ...prev, password: '' }));
        } else {
          // Algunos setups requieren confirmación por correo
          setUiStatus('success');
          setSuccessMessage('Te enviamos un correo para confirmar tu cuenta. Luego podrás iniciar sesión.');
          setIsLoginMode(true);
          setFormData((prev) => ({ ...prev, password: '' }));
        }
      }
    } catch (err) {
      console.error('Operation failed:', err);
      setUiStatus('error');
      setError(friendlyError(err));
      setTimeout(() => setUiStatus('idle'), 900);
    } finally {
      setIsLoading(false);
      if (uiStatus === 'checking') setUiStatus('idle');
    }
  };

  const BrandIcon = () => {
    // Estado visual sutil según uiStatus
    if (uiStatus === 'success') {
      return <Icon name="CheckCircle" size={34} color="#22C55E" />;
    }
    if (uiStatus === 'checking') {
      return <Icon name="ScanFace" size={34} color="var(--color-primary)" />;
    }
    if (uiStatus === 'error') {
      return <Icon name="AlertTriangle" size={34} color="var(--color-error)" />;
    }
    return <Icon name="Dumbbell" size={34} color="#FFFFFF" />;
  };

  return (
    <>
      <Helmet>
        <title>{title} - VC Fit</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-stone-50">
        {/* Dot grid fondo */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />

        {/* Glow ambiental */}
        <div
          className="absolute w-[900px] h-[900px] rounded-full blur-3xl pointer-events-none"
          style={{
            left: `${glow.x}%`,
            top: `${glow.y}%`,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at center, rgba(99,102,241,0.18), rgba(59,130,246,0.10), rgba(245,158,11,0.08), transparent 65%)'
          }}
        />

        {/* Contenedor */}
        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg border border-white/60 bg-stone-900">
              <BrandIcon />
            </div>

            <h1 className="text-3xl font-heading font-bold text-stone-900 tracking-tight">
              VC Fit
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              Plataforma de gestión deportiva y rendimiento
            </p>
          </div>

          {/* Card */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative rounded-3xl border border-white/60 bg-white/85 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden"
            style={{
              transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transformStyle: 'preserve-3d',
              transition: 'transform 120ms ease-out'
            }}
          >
            {/* Scan line */}
            <div
              className="absolute left-0 right-0 h-24 pointer-events-none"
              style={{
                top: uiStatus === 'checking' || uiStatus === 'success' ? '120%' : '-120%',
                transition: 'top 900ms ease-in-out',
                background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.12), transparent)'
              }}
            />

            <div className="p-8">
              {/* Tabs */}
              <div className="flex p-1 rounded-xl bg-stone-100/70 border border-stone-200 mb-6">
                <button
                  type="button"
                  onClick={() => { setIsLoginMode(true); setError(''); setSuccessMessage(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all tracking-widest uppercase ${
                    isLoginMode
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Ingresar
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLoginMode(false); setError(''); setSuccessMessage(''); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all tracking-widest uppercase ${
                    !isLoginMode
                      ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  Activar cuenta
                </button>
              </div>

              {/* Title inside */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                  {isLoginMode ? 'Acceso' : 'Activación'}
                </h2>
                <p className="text-stone-500 text-sm mt-1">
                  {isLoginMode
                    ? 'Ingresá con tu email y contraseña.'
                    : 'Activá tu cuenta para acceder al portal.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLoginMode && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label htmlFor="fullName" className="block text-xs font-bold text-stone-700 mb-2 tracking-widest uppercase">
                      Nombre completo
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
                  <label htmlFor="email" className="block text-xs font-bold text-stone-700 mb-2 tracking-widest uppercase">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="tuemail@..."
                    className="w-full"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-xs font-bold text-stone-700 tracking-widest uppercase">
                      Contraseña
                    </label>

                    {!isLoginMode && (
                      <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest">
                        (mín. 6 caracteres)
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full pr-12 text-center tracking-[0.35em]"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={18} />
                    </button>
                  </div>
                </div>

                {/* Alerts */}
                {error && (
                  <div className="rounded-xl p-3 flex items-start gap-2 bg-red-50 border border-red-100 animate-in fade-in">
                    <Icon name="AlertCircle" size={18} color="var(--color-error)" className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-xl p-3 flex items-start gap-2 bg-green-50 border border-green-100 animate-in fade-in">
                    <Icon name="CheckCircle" size={18} color="var(--color-success)" className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-700">{successMessage}</p>
                  </div>
                )}

                {/* Main CTA */}
                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  iconName={isLoginMode ? "LogIn" : "UserPlus"}
                >
                  {uiStatus === 'checking'
                    ? (isLoginMode ? 'Verificando...' : 'Activando...')
                    : (isLoginMode ? 'Ingresar' : 'Activar')}
                </Button>

                {/* Secondary actions */}
                {isLoginMode && (
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-[10px] text-stone-400 hover:text-stone-700 transition-colors uppercase tracking-widest font-semibold"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                    <span className="text-[10px] text-stone-300 uppercase tracking-widest font-semibold">
                      Acceso controlado
                    </span>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Firma DigitalMatch */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <span className="text-[10px] text-stone-400 uppercase tracking-widest">Engineered by</span>
            <a
              href="https://www.digitalmatchglobal.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative px-5 py-2 rounded-full bg-white border border-stone-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 flex items-center gap-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-violet-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-1 bg-stone-100 rounded-full group-hover:bg-white transition-colors">
                <Icon name="Zap" size={12} className="text-stone-400 group-hover:text-[#6D5DFE] transition-all" />
              </div>
              <span className="relative text-xs font-bold text-stone-600 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-[#2563EB] group-hover:to-[#6D5DFE] transition-all">
                DIGITAL MATCH GLOBAL
              </span>
            </a>
          </div>

          {/* Microcopy */}
          <div className="mt-5 text-center text-[10px] text-stone-400 uppercase tracking-widest">
            {isLoginMode ? 'Acceso a plataforma' : 'Activación de cuenta'}
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRoleSelection;
