import type { ReactNode } from 'react'

/** Dashboard panel frame: heading, optional controls row, content. */
export function Panel({ title, controls, children }: { title: string; controls?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {controls}
      </div>
      {children}
    </section>
  )
}
