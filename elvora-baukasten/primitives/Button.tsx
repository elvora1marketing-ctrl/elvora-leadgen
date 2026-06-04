import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

const variantStyles = {
  primary:
    'bg-gradient-to-r from-[#E1106E] to-[#FF6A3D] text-white hover:brightness-110 active:brightness-95',
  secondary:
    'border border-[#26262A] bg-transparent text-[#FAFAFA] hover:border-[#3A3A40] hover:bg-[#141416] active:bg-[#1C1C20]',
  ghost:
    'bg-transparent text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#141416] active:bg-[#1C1C20]',
} as const;

const sizeStyles = {
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-5 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2.5',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', asChild = false, className = '', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E1106E]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0B] disabled:pointer-events-none disabled:opacity-40 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
