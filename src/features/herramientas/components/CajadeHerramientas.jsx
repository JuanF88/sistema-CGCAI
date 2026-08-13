'use client'

import { BookOpen, FileSearch, FolderOpen, GraduationCap, ScrollText } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { PAGE_SHELL } from '@/components/ui/tokens'

/**
 * Accesos a las carpetas de Drive con recursos y documentación.
 * Para añadir o quitar un recurso, edita esta lista.
 */
const HERRAMIENTAS = [
  {
    label: 'Auditoría Interna',
    icon: FileSearch,
    href: 'https://drive.google.com/drive/folders/18cizZ_mqewb0VCJTwk5ut_9tw8C7Skvo?usp=drive_link',
  },
  {
    label: 'Documentos Seguimiento',
    icon: FolderOpen,
    href: 'https://drive.google.com/drive/folders/1JRs4LNnr79QtUe93l2GCvy4E-7uJBgn5?usp=drive_link',
  },
  {
    label: 'Normatividad',
    icon: ScrollText,
    href: 'https://drive.google.com/drive/folders/1c9xLgg96SsJ681LwP8j6w3mN1GleXIC5?usp=drive_link',
  },
  {
    label: 'Bibliografía',
    icon: BookOpen,
    href: 'https://drive.google.com/drive/folders/1Kr-TH_9rH6KUWHb-VjvPuBiVYPqqfTTe?usp=drive_link',
  },
  {
    label: 'Material de Estudio',
    icon: GraduationCap,
    href: 'https://drive.google.com/drive/folders/1HbbxfrjcilcpvPyo7vKcELN1oJ9rLzUa?usp=drive_link',
  },
]

export default function CajaHerramientas() {
  return (
    <div className={`${PAGE_SHELL}`}>
      <PageHeader
        title="Caja de Herramientas"
        subtitle="Accede a recursos y documentación para tu trabajo"
      />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {HERRAMIENTAS.map(({ label, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-8 w-8" />
            </span>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </a>
        ))}
      </section>
    </div>
  )
}
