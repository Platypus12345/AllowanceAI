export function Skeleton({ className = '', style }) {
  return (
    <div
      className={`relative overflow-hidden bg-white/5 rounded-xl ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="glass-card p-4 rounded-3xl space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-1.5 w-full" />
    </div>
  );
}

export function ExpenseItemSkeleton() {
  return (
    <div className="glass-card p-4 rounded-2xl flex gap-4">
      <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="glass-card p-6 rounded-[2rem] space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="flex items-end justify-center gap-2 h-32">
        {[60, 80, 45, 90, 55, 70, 85].map((h, i) => (
          <Skeleton
            key={i}
            className="w-8 rounded-t-lg flex-shrink-0"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="glass-card p-6 rounded-[2rem] space-y-4">
      <div className="flex gap-4">
        <Skeleton className="w-12 h-12 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <Skeleton className="w-24 h-24 rounded-[2rem]" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="glass-card p-6 rounded-[2rem] space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-14 h-14 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AITypingIndicator() {
  return (
    <div className="flex gap-3 max-w-[85%]">
      <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
        🤖
      </div>
      <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[#44e2cd] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
