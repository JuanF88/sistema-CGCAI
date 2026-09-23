/**
 * Pesos de la nota final de los auditores, por periodo.
 *
 * La nota combina tres fuentes —archivos entregados, encuesta de la dependencia
 * auditada y rúbrica del evaluador— y cuánto vale cada una se decide por
 * semestre, que es como se organiza el ciclo de evaluación.
 *
 * El cálculo en sí vive en `calcular_nota_final`, la función de Postgres que ya
 * llaman los seis sitios donde se recalcula una nota. Aquí solo se guarda la
 * configuración y se vuelven a pasar por esa función las evaluaciones del
 * periodo, para que el cambio se note sin esperar a que alguien toque cada una.
 *
 * `GET` lo puede consultar cualquiera del sistema: el auditor tiene derecho a
 * saber con qué pesos se le califica. Escribir es cosa de administración.
 */
import { requireAuth, requireRole } from '@/lib/api/guard'
import { withRoute } from '@/lib/api/handler'
import { DomainError, fromPostgresError } from '@/lib/api/errors'
import { json } from '@/lib/api/response'
import { ROLES } from '@/lib/auth/roles'
import { pesosEvaluacionSchema } from '@/features/evaluaciones/dto/evaluacion-dto'
import { periodo as periodoSchema } from '@/lib/dto/common'

/**
 * Lo que se aplica mientras nadie configure el periodo.
 *
 * Son los mismos valores que traían por defecto las columnas
 * `ponderacion_*` de `evaluaciones_auditores`, así que no configurar nada deja
 * el sistema exactamente como estaba.
 */
export const PESOS_POR_DEFECTO = { peso_archivos: 33, peso_encuesta: 33, peso_rubrica: 34 }

const soloPesos = (fila) => ({
  peso_archivos: fila.peso_archivos,
  peso_encuesta: fila.peso_encuesta,
  peso_rubrica: fila.peso_rubrica,
})

/**
 * La tabla todavía no existe porque nadie ha pasado `sql/pesos-evaluacion.sql`.
 *
 * Se distingue de cualquier otro fallo para poder decirlo con esas palabras en
 * la pantalla, en vez de soltar un «relation does not exist» al usuario.
 */
const faltaLaTabla = (error) => error?.code === '42P01' || error?.code === 'PGRST205'

export const GET = withRoute(async (request) => {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const periodo = periodoSchema().parse(new URL(request.url).searchParams.get('periodo') ?? '')

  const { data, error } = await guard.admin
    .from('evaluaciones_pesos')
    .select('periodo, peso_archivos, peso_encuesta, peso_rubrica, updated_at')
    .eq('periodo', periodo)
    .maybeSingle()

  if (error && !faltaLaTabla(error)) {
    throw fromPostgresError(error, 'No se pudieron leer los pesos del periodo')
  }

  const { count } = await guard.admin
    .from('evaluaciones_auditores')
    .select('id', { count: 'exact', head: true })
    .eq('periodo', periodo)

  return json({
    periodo,
    // `configurado: false` significa «nadie lo ha decidido», que no es lo mismo
    // que «vale 33/33/34 porque alguien lo puso así».
    configurado: Boolean(data),
    pesos: data ? soloPesos(data) : PESOS_POR_DEFECTO,
    actualizado: data?.updated_at ?? null,
    evaluaciones: count ?? 0,
    pendienteMigracion: Boolean(error),
  })
})

export const PUT = withRoute(async (request) => {
  const guard = await requireRole(ROLES.ADMIN)
  if (!guard.ok) return guard.response

  const dto = pesosEvaluacionSchema.parse(await request.json())

  const { data, error } = await guard.admin
    .from('evaluaciones_pesos')
    .upsert(
      {
        ...dto,
        actualizado_por: guard.usuario?.auth_user_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'periodo' }
    )
    .select('periodo, peso_archivos, peso_encuesta, peso_rubrica, updated_at')
    .single()

  if (faltaLaTabla(error)) {
    throw new DomainError(
      'Falta ejecutar sql/pesos-evaluacion.sql en Supabase: la tabla de pesos todavía no existe.',
      { status: 409, code: 'PESOS_SIN_MIGRAR' }
    )
  }
  if (error) throw fromPostgresError(error, 'No se pudieron guardar los pesos')

  // Las evaluaciones del periodo se vuelven a calcular con los pesos nuevos.
  // Solo las de este periodo: lo calificado en semestres anteriores no se
  // toca, que es lo que permite cambiar el criterio de un año sin reescribir
  // la historia del anterior.
  const { data: delPeriodo, error: errorLista } = await guard.admin
    .from('evaluaciones_auditores')
    .select('id')
    .eq('periodo', dto.periodo)

  if (errorLista) throw fromPostgresError(errorLista, 'No se pudieron listar las evaluaciones')

  let recalculadas = 0
  const fallidas = []

  for (const { id } of delPeriodo ?? []) {
    const { error: errorRpc } = await guard.admin.rpc('calcular_nota_final', {
      evaluacion_id: id,
    })

    if (errorRpc) {
      console.error(`[pesos] no se pudo recalcular la evaluación ${id}:`, errorRpc.message)
      fallidas.push(id)
    } else {
      recalculadas++
    }
  }

  return json({
    periodo: data.periodo,
    pesos: soloPesos(data),
    recalculadas,
    // Se informa en vez de fallar: los pesos ya quedaron guardados y el
    // recálculo se puede repetir.
    fallidas: fallidas.length,
  })
})
