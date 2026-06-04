import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`h-10 w-full rounded-xl border border-[#26262A] bg-[#141416] px-4 text-sm text-[#FAFAFA] placeholder:text-[#636366] transition-colors duration-150 hover:border-[#3A3A40] focus:border-[#E1106E]/50 focus:outline-none focus:ring-1 focus:ring-[#E1106E]/25 disabled:pointer-events-none disabled:opacity-40 ${className}`}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
