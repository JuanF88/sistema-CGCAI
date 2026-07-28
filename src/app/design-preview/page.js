import { notFound } from 'next/navigation'
import PreviewContent from './PreviewContent'

/**
 * Escaparate del sistema de diseño: header, tarjetas KPI, tabla, badges y
 * botones, para revisarlos de un vistazo en claro y en oscuro.
 *
 * Solo existe en desarrollo (`npm run dev`); en producción devuelve 404.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return <PreviewContent />
}
