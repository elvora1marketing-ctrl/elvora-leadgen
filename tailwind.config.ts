import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        elvora: {
          bg: '#080810',
          'bg-alt': '#0c0c18',
          card: '#12121e',
          'card-alt': '#181828',
          'card-hover': '#1c1c30',
          surface: '#1a1a2e',
          // Primary - Elvora Violet
          primary: '#8B5CF6',
          'primary-light': '#A78BFA',
          'primary-dark': '#7C3AED',
          purple: '#8B5CF6',
          'purple-light': '#A78BFA',
          'purple-dark': '#7C3AED',
          // Secondary - Elvora Pink
          pink: '#EC4899',
          'pink-light': '#F472B6',
          // Accent - Elvora Orange
          accent: '#F97316',
          'accent-light': '#FB923C',
          // Text
          text: '#ffffff',
          'text-muted': '#94a3b8',
          'text-dim': '#525280',
          // Status
          success: '#10b981',
          danger: '#ef4444',
          warning: '#F97316',
          // Chart colors
          'chart-1': '#8B5CF6',
          'chart-2': '#EC4899',
          'chart-3': '#06b6d4',
          'chart-4': '#F97316',
          'chart-5': '#10b981',
        },
      },
      backgroundImage: {
        'elvora-gradient': 'linear-gradient(135deg, #8B5CF6, #EC4899)',
        'elvora-gradient-hover': 'linear-gradient(135deg, #9D6FFF, #F472B6)',
        'elvora-gradient-warm': 'linear-gradient(135deg, #EC4899, #F97316)',
        'elvora-gradient-hot': 'linear-gradient(135deg, #ef4444, #F97316)',
        'elvora-gradient-cold': 'linear-gradient(135deg, #3b82f6, #8B5CF6)',
        'elvora-gradient-subtle': 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.05))',
        'elvora-gradient-card': 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 60%)',
      },
      boxShadow: {
        'elvora': '0 4px 24px rgba(139, 92, 246, 0.15)',
        'elvora-lg': '0 8px 40px rgba(139, 92, 246, 0.25)',
        'elvora-pink': '0 4px 24px rgba(236, 72, 153, 0.15)',
        'elvora-glow': '0 0 20px rgba(139, 92, 246, 0.3)',
        'elvora-glow-sm': '0 0 10px rgba(139, 92, 246, 0.2)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(139, 92, 246, 0.08)',
        'inset-glow': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      animation: {
        'slide-left': 'slideLeft 0.4s ease-out',
        'slide-right': 'slideRight 0.4s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 2s infinite linear',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'count-up': 'countUp 0.6s ease-out',
      },
      keyframes: {
        slideLeft: {
          '0%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateX(-120%) rotate(-15deg)', opacity: '0' },
        },
        slideRight: {
          '0%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateX(120%) rotate(15deg)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(139, 92, 246, 0.1)' },
          '50%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
