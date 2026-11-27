import * as React from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[#19283B] border border-[#26364A]/60', className)}
      {...props}
    />
  )
}
