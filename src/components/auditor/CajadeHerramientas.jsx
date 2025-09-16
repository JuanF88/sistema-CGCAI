'use client'

import {
  FileSearch,
  FolderOpen,
  ScrollText,
  BookOpen,
  GraduationCap
} from 'lucide-react'
import styles from '@/components/CSS/cajadeherramientas.module.css'

export default function CajaHerramientas() {
  return (
    <section className={styles.cajaHerramientas}>
      <h3 className={styles.tituloHerramientas}>🧰 Caja de Herramientas</h3>
      <div className={styles.gridHerramientas}>
        <a
          href="https://drive.google.com/drive/folders/1Wz6aFBomgZV0kSMFpxUyQz1hqZGx1TJb?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <FileSearch size={40} />
          <span>Auditoría Interna</span>
        </a>

        <a
          href="https://drive.google.com/drive/folders/1fmsHMGx_HQgDWcb6KMGhw3kQR0XOUgDT?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <FolderOpen size={40} />
          <span>Documentos Seguimiento</span>
        </a>

        <a
          href="https://drive.google.com/drive/folders/1IhbBu4Uxh-4oN5a82DsBdmuy-tas8Inb?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <ScrollText size={40} />
          <span>Normatividad</span>
        </a>

        <a
          href="https://drive.google.com/drive/folders/10ELYEj9Ei1Js-WvLqxfoXqTsCgG3cuHm?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <BookOpen size={40} />
          <span>Bibliografía</span>
        </a>

        <a
          href="https://drive.google.com/drive/folders/1-SnrpX90uCR-q6NuwIqK-q1tFIOxltp4?usp=drive_link"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <GraduationCap size={40} />
          <span>Material de Estudio</span>
        </a>
      </div>
    </section>
  )
}
