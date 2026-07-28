'use client'

/** Bloque informativo con icono y título, para las notas de cada pestaña. */
export function InfoBox({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/25">
      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="flex flex-col gap-2 text-muted-foreground">{children}</div>
    </div>
  )
}
