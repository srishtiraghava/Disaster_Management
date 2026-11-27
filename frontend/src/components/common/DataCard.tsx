import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DataCardProps {
  title: string
  description?: string
  headerAction?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function DataCard({
  title,
  description,
  headerAction,
  children,
  className,
  contentClassName,
}: DataCardProps) {
  return (
    <Card className={cn('hover:border-[#38BDF8]/35', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-[#26364A]/70 pb-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-0.5">{description}</CardDescription> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </CardHeader>
      <CardContent className={cn('pt-4', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
