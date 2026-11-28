import { Skeleton } from '@/components/ui/skeleton'

interface LoadingSkeletonProps {
  cards?: number
  rows?: number
}

export function LoadingSkeleton({ cards = 4, rows = 3 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, idx) => (
          <Skeleton key={idx} className="h-28 w-full" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
