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
          'bg-alt': '#12121a',
          card: '#1a1a2e',
          'card-alt': '#16162a',
          purple: '#6c5ce7',
          'purple-light': '#a78bfa',
          gold: '#f0c040',
          text: '#ffffff',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f97316',
        },
      },
      backgroundImage: {
        'elvora-gradient': 'linear-gradient(135deg, #6c5ce7, #a78bfa)',
        'elvora-gradient-hover': 'linear-gradient(135deg, #7c6cf7, #b79bff)',
        'elvora-gold-gradient': 'linear-gradient(135deg, #f0c040, #f5d060)',
      },
      boxShadow: {
        'elvora': '0 4px 24px rgba(108, 92, 231, 0.15)',
        'elvora-lg': '0 8px 40px rgba(108, 92, 231, 0.25)',
        'elvora-gold': '0 4px 24px rgba(240, 192, 64, 0.15)',
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
