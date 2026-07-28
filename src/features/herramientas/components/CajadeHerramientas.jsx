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
    href: 'https://drive.google.com/drive/folders/1Wz6aFBomgZV0kSMFpxUyQz1hqZGx1TJb?usp=drive_link',
  },
  {
    label: 'Documentos Seguimiento',
    icon: FolderOpen,
    href: 'https://drive.google.com/drive/folders/1fmsHMGx_HQgDWcb6KMGhw3kQR0XOUgDT?usp=drive_link',
  },
  {
    label: 'Normatividad',
    icon: ScrollText,
    href: 'https://drive.google.com/drive/folders/1IhbBu4Uxh-4oN5a82DsBdmuy-tas8Inb?usp=drive_link',
  },
  {
    label: 'Bibliografía',
    icon: BookOpen,
    href: 'https://drive.google.com/drive/folders/10ELYEj9Ei1Js-WvLqxfoXqTsCgG3cuHm?usp=drive_link',
  },
  {
    label: 'Material de Estudio',
    icon: GraduationCap,
    href: 'https://drive.google.com/drive/folders/1-SnrpX90uCR-q6NuwIqK-q1tFIOxltp4?usp=drive_link',
  },
]

export default function CajaHerramientas() {
  return (
    <div className={`${PAGE_SHELL}`}>
      <PageHeader
        icon="🧰"
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
