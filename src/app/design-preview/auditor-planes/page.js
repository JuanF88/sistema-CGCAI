import { notFound } from 'next/navigation'

import VistaPrevia from './VistaPrevia'

/**
 * TEMPORAL — «Planes de Mejoramiento» tal como lo ve el auditor.
 *
 * La pantalla del auditor vive detrás de su propio inicio de sesión, así que
 * para revisar el diseño sin entrar con la cuenta de un auditor se monta aquí
 * el mismo componente con los mismos props: el menú del auditor y
 * `usuarioId`, que es lo único que cambia respecto al administrador.
 *
 * Los datos los trae la sesión del navegador, así que se ve con quien esté
 * dentro. Solo existe en desarrollo; en producción devuelve 404.
 *
 * Se elimina tras validar el diseño.
 */
export default async function AuditorPlanesPreviewPage({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound()

  const params = await searchParams
  const auditor = Number(params?.auditor) || 18

  return <VistaPrevia auditorId={auditor} />
}
