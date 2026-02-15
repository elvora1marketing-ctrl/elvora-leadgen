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
          bg: '#0a0a0f',
          'bg-alt': '#111118',
          card: '#18181f',
          'card-alt': '#1e1e28',
          // Primary - Elvora Violet
          primary: '#8B5CF6',
          'primary-light': '#A78BFA',
          'primary-dark': '#7C3AED',
          // Secondary - Elvora Pink
          pink: '#EC4899',
          'pink-light': '#F472B6',
          // Accent - Elvora Orange
          accent: '#F97316',
          'accent-light': '#FB923C',
          // Text
          text: '#ffffff',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          // Status
          success: '#10b981',
          danger: '#ef4444',
          warning: '#F97316',
        },
      },
      backgroundImage: {
        'elvora-gradient': 'linear-gradient(135deg, #8B5CF6, #EC4899)',
        'elvora-gradient-hover': 'linear-gradient(135deg, #9D6FFF, #F472B6)',
        'elvora-gradient-warm': 'linear-gradient(135deg, #EC4899, #F97316)',
        'elvora-gradient-hot': 'linear-gradient(135deg, #ef4444, #F97316)',
        'elvora-gradient-cold': 'linear-gradient(135deg, #3b82f6, #8B5CF6)',
      },
      boxShadow: {
        'elvora': '0 4px 24px rgba(139, 92, 246, 0.15)',
        'elvora-lg': '0 8px 40px rgba(139, 92, 246, 0.25)',
        'elvora-pink': '0 4px 24px rgba(236, 72, 153, 0.15)',
        'elvora-glow': '0 0 20px rgba(139, 92, 246, 0.3)',
      },
      animation: {
        'slide-left': 'slideLeft 0.4s ease-out',
        'slide-right': 'slideRight 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
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
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
