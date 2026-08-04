/**
 * POST /api/informes/validar-alineacion
 *
 * Revisa si el objetivo y las conclusiones que está escribiendo el auditor
 * desarrollan el objetivo general del programa. Devuelve un veredicto por
 * campo; no guarda nada ni condiciona el guardado del informe.
 *
 * La llamada sale de aquí y no del navegador porque la clave de OpenAI es un
 * secreto del servidor: en el bundle del cliente cualquiera podría leerla y
 * gastar el saldo de la cuenta.
 *
 * `requireAuth` y no `requireRole`: quien rellena el informe es el auditor.
 */
import { requireAuth } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { json } from '@/lib/api/response'
import { contextoNormativo } from '@/lib/catalogos/iso'
import { revisarAlineacion } from '@/lib/ia/alineacion'
import { revisarAlineacionSchema } from '@/features/auditorias/dto/alineacion-dto'

/** Sin tildes ni mayúsculas: el cronograma se escribe a mano. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .trim()

/**
 * Los requisitos ISO que el programa asignó al proceso de esta auditoría.
 *
 * El camino es: informe → programa del que salió → sección del cronograma que
 * incluye su dependencia → `requisitos_9001` y `requisitos_14001`. Es el único
 * sitio donde consta qué se va a auditar de las normas, y viene decidido al
 * planificar el año, no al escribir el informe.
 *
 * Se resuelve en el servidor y no se acepta del cliente a propósito: son los
 * requisitos de un programa aprobado, no algo que el auditor deba poder
 * cambiar desde el formulario.
 *
 * Devuelve `''` cuando la auditoría se creó a mano, cuando la dependencia no
 * casa con ninguna línea o cuando la sección no declara requisitos. En todos
 * esos casos la revisión sigue, solo que sin contexto normativo.
 */
async function requisitosDeLaAuditoria(db, informeId) {
  if (!informeId) return ''

  const { data: informe, error } = await db
    .from('informes_auditoria')
    .select('id, programa_auditoria_id, dependencias:dependencia_id ( nombre )')
    .eq('id', informeId)
    .maybeSingle()

  // Un fallo aquí no debe tumbar la revisión: se pierde el contexto y ya.
  if (error || !informe?.programa_auditoria_id) return ''

  const { data: secciones, error: errorCronograma } = await db
    .from('programa_auditoria_cronograma')
    .select(
      'requisitos_9001, requisitos_14001, dependencias:programa_auditoria_cronograma_dependencias ( auditado )'
    )
    .eq('programa_id', informe.programa_auditoria_id)

  if (errorCronograma || !secciones?.length) return ''

  const auditada = normalizar(informe.dependencias?.nombre)
  if (!auditada) return ''

  const seccion = secciones.find((s) =>
    (s.dependencias ?? []).some((d) => normalizar(d.auditado) === auditada)
  )

  return seccion ? contextoNormativo(seccion) : ''
}

export const POST = withRoute(async (request) => {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const dto = revisarAlineacionSchema.parse(await request.json())

  const requisitos = await requisitosDeLaAuditoria(guard.admin, dto.informe_id)

  const resultado = await revisarAlineacion({
    objetivoPrograma: dto.objetivo_programa,
    objetivo: dto.objetivo,
    conclusiones: dto.conclusiones,
    requisitos,
  })

  return json(resultado)
})
