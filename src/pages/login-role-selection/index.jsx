import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';

const LoginRoleSelection = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uiStatus, setUiStatus] = useState('idle'); // idle | checking | success | error
  const [error, setError] = useState('');

  // --- UI: Tilt + Glow ---
  const cardRef = useRef(null);
  const rafRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [glow, setGlow] = useState({ x: 50, y: 40 });

  const title = "Iniciar Sesión";

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    const gx = Math.max(0, Math.min(100, px * 100));
    const gy = Math.max(0, Math.min(100, py * 100));

    const max = 6;
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
    return msg;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setUiStatus('checking');
    setError('');

    try {
      const { error: loginError, user } = await login({
        email: formData.email,
        password: formData.password
      });

      if (loginError) throw loginError;

      setUiStatus('success');

      const targetPath = redirectByRole(user?.role);
      
      // Pequeño delay para mostrar el tick verde de éxito
      setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 450);

    } catch (err) {
      console.error('Login failed:', err);
      setUiStatus('error');
      setError(friendlyError(err));
      
      // Volver a estado normal después de mostrar error
      setTimeout(() => setUiStatus('idle'), 1500);
    } finally {
      setIsLoading(false);
    }
  };

  const BrandIcon = () => {
    if (uiStatus === 'success') return <Icon name="CheckCircle" size={34} color="#22C55E" />;
    if (uiStatus === 'checking') return <Icon name="ScanFace" size={34} color="var(--color-primary)" />;
    if (uiStatus === 'error') return <Icon name="AlertTriangle" size={34} color="var(--color-error)" />;
    return <Icon name="Dumbbell" size={34} color="#FFFFFF" />;
  };

  return (
    <>
      <Helmet>
        <title>{title} - VC Fit</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-stone-50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />

        {/* Dynamic Glow Background */}
        <div
          className="absolute w-[900px] h-[900px] rounded-full blur-3xl pointer-events-none"
          style={{
            left: `${glow.x}%`,
            top: `${glow.y}%`,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at center, rgba(99,102,241,0.18), rgba(59,130,246,0.10), rgba(245,158,11,0.08), transparent 65%)'
          }}
        />

        <div className="w-full max-w-md relative z-10">
          
          {/* Header Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg border border-white/60 bg-stone-900 transition-all duration-300">
              <BrandIcon />
            </div>

            <h1 className="text-3xl font-heading font-bold text-stone-900 tracking-tight">
              VC Fit
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              Plataforma de gestión deportiva y rendimiento
            </p>
          </div>

          {/* Login Card */}
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative rounded-3xl border border-white/60 bg-white/85 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden transition-all duration-200"
            style={{
              transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Loading Overlay Gradient */}
            <div
              className="absolute left-0 right-0 h-24 pointer-events-none"
              style={{
                top: uiStatus === 'checking' || uiStatus === 'success' ? '120%' : '-120%',
                transition: 'top 900ms ease-in-out',
                background: 'linear-gradient(to bottom, transparent, rgba(59,130,246,0.12), transparent)'
              }}
            />

            <div className="p-8">
              
              <div className="mb-6">
                <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                  Acceso
                </h2>
                <p className="text-stone-500 text-sm mt-1">
                  Ingresá con tu email y contraseña.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Email Input */}
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

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-xs font-bold text-stone-700 tracking-widest uppercase">
                      Contraseña
                    </label>
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

                {/* Error Message */}
                {error && (
                  <div className="rounded-xl p-3 flex items-start gap-2 bg-red-50 border border-red-100 animate-in fade-in slide-in-from-top-1">
                    <Icon name="AlertCircle" size={18} color="var(--color-error)" className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600 font-medium">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="default"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  iconName={uiStatus === 'success' ? 'Check' : 'LogIn'}
                  className={uiStatus === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  {uiStatus === 'checking' ? 'Verificando...' : uiStatus === 'success' ? '¡Bienvenido!' : 'Ingresar'}
                </Button>

                {/* Footer Links */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')} // Redirección limpia
                    className="text-[10px] text-stone-400 hover:text-stone-700 transition-colors uppercase tracking-widest font-bold hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                  <span className="text-[10px] text-stone-300 uppercase tracking-widest font-semibold cursor-help" title="Sistema Seguro">
                    Acceso controlado
                  </span>
                </div>

              </form>
            </div>
          </div>

          {/* Footer Branding */}
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

          <div className="mt-5 text-center text-[10px] text-stone-400 uppercase tracking-widest">
            Acceso a plataforma
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginRoleSelection;