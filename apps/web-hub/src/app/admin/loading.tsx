export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse p-1" aria-busy="true" aria-live="polite">
      {/* En-tête de page skeleton */}
      <div className="p-6 rounded-2xl bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-2">
          <div className="h-6 w-56 rounded-lg bg-secondary" />
          <div className="h-4 w-96 max-w-full rounded bg-secondary/60" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 rounded-lg bg-secondary" />
          <div className="h-8 w-32 rounded-lg bg-primary/10 border border-primary/20" />
        </div>
      </div>

      {/* Cartes métriques KPI skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-xs"
          >
            <div className="space-y-2 flex-1">
              <div className="h-3 w-24 rounded bg-secondary" />
              <div className="h-7 w-20 rounded bg-secondary" />
              <div className="h-2.5 w-16 rounded bg-secondary/50" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-secondary" />
          </div>
        ))}
      </div>

      {/* Bloc principal contenu / tableau skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 rounded bg-secondary" />
          <div className="h-7 w-28 rounded bg-secondary/60" />
        </div>
        <div className="space-y-3 pt-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-secondary/40 border border-border/40" />
          ))}
        </div>
      </div>
    </div>
  );
}
