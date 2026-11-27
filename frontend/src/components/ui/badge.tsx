import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]',
        secondary: 'border-[#26364A] bg-[#19283B] text-[#94A3B8]',
        success: 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E]',
        warning: 'border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#F59E0B]',
        danger: 'border-[#EF4444]/40 bg-[#EF4444]/15 text-[#EF4444]',
        indigo: 'border-[#6366F1]/35 bg-[#6366F1]/15 text-[#818CF8]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
