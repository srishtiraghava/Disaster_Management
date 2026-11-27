import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]/60 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#38BDF8] text-[#0B1220] hover:bg-[#38BDF8]/90 font-semibold shadow-sm',
        secondary: 'bg-[#19283B] text-[#F8FAFC] border border-[#26364A] hover:bg-[#26364A]/70',
        outline: 'border border-[#26364A] bg-transparent text-[#F8FAFC] hover:bg-[#19283B]',
        ghost: 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#19283B]',
        destructive: 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/40 hover:bg-[#EF4444]/25',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-lg px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
)
Button.displayName = 'Button'
