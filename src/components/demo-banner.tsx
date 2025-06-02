export function DemoBanner() {
  return (
    <div className="border-b bg-muted/30 px-4 py-3 text-center">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold text-muted-foreground">
          Turnkey Demo Product
        </p>
        <p className="text-xs text-muted-foreground/80">
          Not a production system. Not in scope for security research.
        </p>
      </div>
    </div>
  )
}