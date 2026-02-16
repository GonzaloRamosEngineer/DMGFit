import React, { useMemo } from 'react';
import Icon from '../../../components/AppIcon';

// --- CONFIGURATION & UTILS ---

const TIERS = {
  BRONZE: { color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', label: 'Bronze' },
  SILVER: { color: 'text-slate-400', bg: 'bg-slate-100', border: 'border-slate-300', label: 'Silver' },
  GOLD: { color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Gold' },
  PLATINUM: { color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'Platinum' }
};

// Definition of all possible achievements in the system
const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'consistency_starter',
    title: 'Disciplina Inicial',
    description: 'Registra tus primeras 5 métricas',
    tier: 'BRONZE',
    icon: 'CheckCircle',
    condition: (metrics) => metrics.length >= 5
  },
  {
    id: 'consistency_master',
    title: 'Atleta Dedicado',
    description: 'Supera los 50 registros totales',
    tier: 'GOLD',
    icon: 'Calendar',
    condition: (metrics) => metrics.length >= 50
  },
  {
    id: 'strength_100',
    title: 'Club de los 100',
    description: 'Levanta 100kg+ en cualquier ejercicio',
    tier: 'SILVER',
    icon: 'Disc',
    condition: (metrics) => metrics.some(m => m.unit === 'kg' && parseFloat(m.value) >= 100)
  },
  {
    id: 'strength_beast',
    title: 'Fuerza Bruta',
    description: 'Registra 150kg+ en un levantamiento',
    tier: 'PLATINUM',
    icon: 'Anchor',
    condition: (metrics) => metrics.some(m => m.unit === 'kg' && parseFloat(m.value) >= 150)
  },
  {
    id: 'speed_demon',
    title: 'Velocidad Luz',
    description: 'Sprint bajo 2.0s o Pace alto',
    tier: 'GOLD',
    icon: 'Zap',
    condition: (metrics) => metrics.some(m => m.name.includes('Sprint') && parseFloat(m.value) < 2.0)
  },
  {
    id: 'data_nerd',
    title: 'Analista',
    description: 'Registra 3 tipos diferentes de métricas',
    tier: 'BRONZE',
    icon: 'PieChart',
    condition: (metrics) => {
        const unique = new Set(metrics.map(m => m.name));
        return unique.size >= 3;
    }
  }
];

/**
 * HOOK: useGamification
 * Centralizes XP calculation and Badge logic
 */
const useGamification = (metrics, attendanceRate) => {
  return useMemo(() => {
    const validMetrics = Array.isArray(metrics) ? metrics : [];
    
    // 1. Calculate Badges (Locked & Unlocked)
    const processedBadges = ACHIEVEMENT_DEFINITIONS.map(def => {
      const isUnlocked = def.condition(validMetrics);
      return { ...def, isUnlocked };
    }).sort((a, b) => {
      // Sort: Unlocked first, then by Tier priority
      if (a.isUnlocked === b.isUnlocked) return 0; // Maintain config order for same state
      return a.isUnlocked ? -1 : 1;
    });

    // 2. XP Logic (Base 100 per level, scaling slightly)
    const metricXP = validMetrics.length * 15;
    const attendanceXP = (attendanceRate || 0) * 5;
    const badgeXP = processedBadges.filter(b => b.isUnlocked).length * 100;
    
    const totalXP = metricXP + attendanceXP + badgeXP;
    
    // Level Calculation: Level = sqrt(XP) roughly, making hard levels harder
    // Simplified: Linear for now for predictability
    const LEVEL_THRESHOLD = 500; 
    const currentLevel = Math.floor(totalXP / LEVEL_THRESHOLD) + 1;
    const xpInCurrentLevel = totalXP % LEVEL_THRESHOLD;
    const progressPercent = (xpInCurrentLevel / LEVEL_THRESHOLD) * 100;

    return {
      badges: processedBadges,
      stats: {
        level: currentLevel,
        totalXP,
        nextLevelXP: LEVEL_THRESHOLD - xpInCurrentLevel,
        progress: progressPercent,
        unlockedCount: processedBadges.filter(b => b.isUnlocked).length,
        totalBadges: processedBadges.length
      }
    };
  }, [metrics, attendanceRate]);
};

// --- SUB-COMPONENTS ---

const LevelCard = ({ stats }) => (
  <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl shadow-slate-200/50 md:col-span-1 group">
    {/* Background Effects */}
    <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-blue-600/20 blur-[80px] transition-all duration-700 group-hover:bg-blue-500/30" />
    <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-[60px]" />

    <div className="relative z-10 flex h-full flex-col justify-between">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="rounded-xl bg-white/5 p-2 backdrop-blur-md border border-white/10">
            <Icon name="Award" className="text-blue-400" size={20} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Elite Member
          </span>
        </div>

        <div className="mb-1">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Nivel Actual</span>
          <h2 className="text-5xl font-black tracking-tighter text-white">
            {stats.level}
          </h2>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Progreso</span>
          <span>{stats.nextLevelXP} XP para Nivel {stats.level + 1}</span>
        </div>
        
        {/* Progress Bar Container */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800/50 box-shadow-inner">
          <div 
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-1000 ease-out"
            style={{ width: `${stats.progress}%` }}
          />
        </div>
        
        <p className="text-right text-[10px] text-slate-500 font-medium">
          Total XP: {stats.totalXP.toLocaleString()}
        </p>
      </div>
    </div>
  </div>
);

const BadgeItem = ({ badge }) => {
  const theme = TIERS[badge.tier] || TIERS.BRONZE;
  
  return (
    <div className={`group relative flex min-w-[200px] flex-col justify-between rounded-3xl border p-5 transition-all duration-300 ${
      badge.isUnlocked 
        ? 'bg-white border-slate-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:shadow-xl' 
        : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
    }`}>
      
      {/* Header Badge */}
      <div className="flex items-start justify-between mb-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:rotate-12 ${
            badge.isUnlocked ? theme.bg : 'bg-slate-200'
        }`}>
          <Icon 
            name={badge.icon} 
            size={22} 
            className={badge.isUnlocked ? theme.color : 'text-slate-400'} 
          />
        </div>
        {badge.isUnlocked && (
           <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg ${theme.bg} ${theme.color}`}>
             {theme.label}
           </span>
        )}
      </div>

      {/* Content */}
      <div>
        <h4 className={`mb-1 font-bold text-sm ${badge.isUnlocked ? 'text-slate-800' : 'text-slate-400'}`}>
          {badge.title}
        </h4>
        <p className="text-[10px] font-medium leading-relaxed text-slate-400">
          {badge.description}
        </p>
      </div>

      {/* Locked Overlay Icon */}
      {!badge.isUnlocked && (
        <div className="absolute right-4 top-4">
           <Icon name="Lock" size={14} className="text-slate-300" />
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

const AchievementsHub = ({ metrics, attendanceRate }) => {
  const { badges, stats } = useGamification(metrics, attendanceRate);

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
      
      {/* 1. Left Column: Player Level Card */}
      <LevelCard stats={stats} />

      {/* 2. Right Column: Trophy Case */}
      <div className="md:col-span-2 flex flex-col rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-sm">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              Logros <span className="text-slate-300">/</span> Badges
            </h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Colección de trofeos & Hitos
            </p>
          </div>
          
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2 border border-slate-100">
             <Icon name="Award" size={16} className="text-slate-900" />
             <span className="text-xs font-bold text-slate-700">
               {stats.unlockedCount} <span className="text-slate-400">/ {stats.totalBadges}</span>
             </span>
          </div>
        </div>

        {/* Horizontal Scrollable Grid */}
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-hide">
          {badges.map((badge) => (
            <BadgeItem key={badge.id} badge={badge} />
          ))}
          
          {/* Placeholder for "More coming soon" */}
          <div className="flex min-w-[140px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 p-6 opacity-50">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
               Próximamente más desafíos
             </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AchievementsHub;