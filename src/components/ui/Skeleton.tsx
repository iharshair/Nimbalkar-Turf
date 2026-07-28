import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

/** Matches the slot grid's layout exactly, so nothing shifts on load. */
export function SlotGridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
      role="status"
      aria-label="Loading available slots"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-[74px] rounded-xl" />
      ))}
      <span className="sr-only">Loading available slots…</span>
    </div>
  )
}
