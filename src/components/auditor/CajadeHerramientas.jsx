'use client'

import {
  ClipboardList,
  FileText,
  CheckSquare,
  ShieldCheck
} from 'lucide-react'
import styles from '@/components/CSS/cajadeherramientas.module.css'

export default function CajaHerramientas() {
  return (
    <section className={styles.cajaHerramientas}>
      <h3 className={styles.tituloHerramientas}>🧰 Caja de Herramientas</h3>
      <div className={styles.gridHerramientas}>
        <a
          href="/archivos/plan-auditoria.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <ClipboardList size={40} />
          <span>Plan de Auditoría</span>
        </a>

        <a
          href="/archivos/formato-no-conformidad.docx"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <FileText size={40} />
          <span>Formato NC</span>
        </a>

        <a
          href="/archivos/lista-verificacion.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <CheckSquare size={40} />
          <span>Lista de Verificación</span>
        </a>

        <a
          href="/archivos/politicas.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.herramienta}
        >
          <ShieldCheck size={40} />
          <span>Políticas</span>
        </a>
      </div>
    </section>
  )
}
