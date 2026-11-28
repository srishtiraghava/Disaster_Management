import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#26364A] bg-[#19283B] text-[#94A3B8]">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[#F8FAFC]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#94A3B8]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  )
}
