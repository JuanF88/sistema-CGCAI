/**
 * Catálogos que alimentan los desplegables de la hoja «Distribución».
 *
 * Tres fuentes, en una sola llamada para no encadenar peticiones al abrir el
 * drawer:
 *   - `dependencias`: procesos, gestiones y organismos oficiales.
 *   - `usuarios`:     personas del sistema, con su correo y sus estudios.
 *   - `sugerencias`:  valores ya escritos en programas anteriores, para los
 *                     campos que no tienen tabla propia (facultad, decanatura,
 *                     títulos). El catálogo se enriquece con el uso.
 *   - `numerales`:    requisitos de cada norma, para el cronograma.
 */
import { requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { fromPostgresError } from '@/lib/api/errors'
import { json } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'

/** Columnas de la distribución de las que se extraen valores distintos. */
const CAMPOS_SUGERIDOS = [
  'organismo',
  'gestion',
  'facultad',
  'proceso',
  'responsable_titulo',
  'auditor_estudios',
  'coordinador_nivel',
  'decanatura_nombre',
  'decano_titulo',
]

/** Valores distintos, sin vacíos y ordenados alfabéticamente. */
function distintos(filas, campo) {
  const vistos = new Map()

  for (const fila of filas) {
    const valor = String(fila[campo] ?? '').trim()
    if (!valor) continue
    // Se conserva la primera grafía vista; la clave evita duplicar por
    // mayúsculas o espacios sobrantes.
    if (!vistos.has(valor.toLowerCase())) vistos.set(valor.toLowerCase(), valor)
  }

  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

/**
 * Numerales agrupados por norma, ordenados como números de versión.
 *
 * `localeCompare` pondría «4.10» antes que «4.2»; los requisitos se leen por
 * tramos numéricos, así que se comparan tramo a tramo.
 */
function numeralesPorNorma(isos, capitulos, numerales) {
  const normaDeCapitulo = new Map(capitulos.map((c) => [c.id, c.iso_id]))
  const capituloDe = new Map(capitulos.map((c) => [c.id, c.capitulo]))
  const porNorma = new Map(isos.map((i) => [i.id, []]))

  for (const n of numerales) {
    const isoId = normaDeCapitulo.get(n.capitulo_id)
    if (!porNorma.has(isoId)) continue

    porNorma.get(isoId).push({
      numeral: String(n.numeral ?? '').trim(),
      capitulo: capituloDe.get(n.capitulo_id) ?? '',
    })
  }

  const comparar = (a, b) => {
    const pa = a.numeral.split('.').map(Number)
    const pb = b.numeral.split('.').map(Number)

    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diferencia = (pa[i] ?? 0) - (pb[i] ?? 0)
      if (diferencia) return diferencia
    }
    return a.numeral.localeCompare(b.numeral, 'es')
  }

  return isos.map((iso) => ({
    id: iso.id,
    norma: iso.iso,
    numerales: (porNorma.get(iso.id) ?? []).filter((n) => n.numeral).sort(comparar),
  }))
}

// GET /api/programa-auditoria/catalogos
export const GET = withRoute(async () => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const [dependencias, usuarios, distribucion, isos, capitulos, numerales] = await Promise.all([
    guard.admin.from('dependencias').select('dependencia_id, nombre, gestion').order('nombre'),
    guard.admin
      .from('usuarios')
      .select(
        'usuario_id, nombre, apellido, email, rol, tipo_personal, estudios, tipo_estudio, dependencia_id'
      )
      .eq('estado', 'activo')
      .order('nombre'),
    guard.admin.from('programa_auditoria_distribucion').select(CAMPOS_SUGERIDOS.join(', ')),
    guard.admin.from('iso').select('id, iso'),
    guard.admin.from('capitulos').select('id, iso_id, capitulo'),
    guard.admin.from('numerales').select('id, capitulo_id, numeral'),
  ])

  if (dependencias.error) throw fromPostgresError(dependencias.error)
  if (usuarios.error) throw fromPostgresError(usuarios.error)
  // Las sugerencias son un extra: si la tabla todavía no existe o está vacía,
  // el drawer debe seguir funcionando con dependencias y usuarios.
  const filas = distribucion.error ? [] : (distribucion.data ?? [])

  // Los catálogos ISO tampoco son imprescindibles: sin ellos los requisitos se
  // siguen pudiendo escribir a mano.
  const normas =
    isos.error || capitulos.error || numerales.error
      ? []
      : numeralesPorNorma(isos.data ?? [], capitulos.data ?? [], numerales.data ?? [])

  return json({
    dependencias: dependencias.data ?? [],
    usuarios: (usuarios.data ?? []).map((u) => ({
      ...u,
      nombreCompleto: [u.nombre, u.apellido].filter(Boolean).join(' ').trim() || u.email,
    })),
    sugerencias: Object.fromEntries(
      CAMPOS_SUGERIDOS.map((campo) => [campo, distintos(filas, campo)])
    ),
    normas,
  })
})
