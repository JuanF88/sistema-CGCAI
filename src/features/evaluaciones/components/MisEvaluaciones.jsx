'use client'

/**
 * Las evaluaciones del propio auditor, con el detalle de la rúbrica.
 *
 * «Mi Dashboard» ya resumía las notas en una tabla, pero el desglose —qué nivel
 * se le dio a cada criterio y por qué— venía en la respuesta del endpoint y no
 * se mostraba en ninguna parte: el auditor veía un 3.5 sin saber de dónde salía.
 *
 * Usa el mismo endpoint que el dashboard (`auditor-dashboard`), que ya autoriza
 * a un auditor a leer únicamente lo suyo.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'

import { obtenerDashboardAuditor } from '@/features/evaluaciones/api/evaluaciones-api'
import { RUBRICA_CRITERIOS, colorNota } from '@/features/evaluaciones/lib/rubrica'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EMPTY_STATE, PAGE_SHELL, SECTION_CARD, STATUS_BADGE_TONES } from '@/components/ui/tokens'
import { cn } from '@/lib/utils'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { Cargando } from '@/components/ui/loader'

const nota = (valor) => (typeof valor === 'number' ? valor.toFixed(2) : '—')

/**
 * Un criterio se califica de 1 a 4; `colorNota` espera la escala 1-5.
 *
 * Es el mismo reescalado que usa `notaDeCalificaciones` para la nota global, así
 * que el color de un criterio y el de la nota final significan lo mismo.
 */
const enEscala5 = (valor) => 1 + (Number(valor) - 1) * (4 / 3)

/** Cómo se presenta cada estado de la evaluación. */
const ESTADOS = {
  publicada: { tono: 'success', texto: 'Publicada' },
  completa: { tono: 'success', texto: 'Completa' },
  borrador: { tono: 'warning', texto: 'En curso' },
}

const estadoDe = (valor) => ESTADOS[valor] ?? { tono: 'neutral', texto: valor || 'Sin evaluar' }

/** Las cuatro notas de una evaluación. */
const NOTAS = [
  { key: 'nota_archivos', label: 'Archivos' },
  { key: 'nota_encuesta', label: 'Encuesta' },
  { key: 'nota_rubrica', label: 'Rúbrica' },
  { key: 'nota_final', label: 'Final', fuerte: true },
]

function Rubrica({ respuestas }) {
  const calificados = RUBRICA_CRITERIOS.filter((c) => respuestas?.[c.id])

  if (!calificados.length) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-center text-xs text-muted-foreground">
        La matriz de rúbrica todavía no se ha diligenciado.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {calificados.map((criterio) => {
        const valor = respuestas[criterio.id]

        return (
          <li
            key={criterio.id}
            className="rounded-xl border border-border bg-background p-3 sm:flex sm:items-start sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{criterio.nombre}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{criterio.descripcion}</p>
              {/* El texto del nivel es lo que explica la nota. */}
              <p className="mt-1.5 text-xs">{criterio.niveles[valor] ?? ''}</p>
            </div>

            <span
              className={cn(
                'mt-2 shrink-0 text-lg font-bold tabular-nums sm:mt-0',
                colorNota(enEscala5(valor))
              )}
              title="Nota del criterio, sobre 4"
            >
              {valor}
              <span className="text-xs font-normal text-muted-foreground"> /4</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function TarjetaEvaluacion({ auditoria, abiertaPorDefecto }) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto)
  const estado = estadoDe(auditoria.estado_evaluacion)

  return (
    <section className={cn(SECTION_CARD, 'overflow-hidden')}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="flex w-full cursor-pointer flex-wrap items-center gap-3 p-4 text-left hover:bg-muted/40"
      >
        {abierta ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{auditoria.dependencia_nombre}</p>
          <p className="text-xs text-muted-foreground">
            Auditoría #{auditoria.informe_id}
            {auditoria.periodo ? ` · ${auditoria.periodo}` : ''}
          </p>
        </div>

        <Badge variant="outline" className={cn(STATUS_BADGE_TONES[estado.tono])}>
          {estado.texto}
        </Badge>

        <span className="text-right">
          <span className="block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Final
          </span>
          <span
            className={cn(
              'text-xl font-bold tabular-nums',
              typeof auditoria.nota_final === 'number'
                ? colorNota(auditoria.nota_final)
                : 'text-muted-foreground'
            )}
          >
            {nota(auditoria.nota_final)}
          </span>
        </span>
      </button>

      {abierta && (
        <div className="space-y-4 border-t border-border p-4">
          {auditoria.estado_evaluacion === 'borrador' && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Esta evaluación está en curso: las notas pueden cambiar hasta que se cierre.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NOTAS.map(({ key, label, fuerte }) => (
              <div key={key} className="rounded-xl border border-border bg-background p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </dt>
                <dd
                  className={cn(
                    'mt-1 text-xl font-bold tabular-nums',
                    fuerte && 'text-primary'
                  )}
                >
                  {nota(auditoria[key])}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Matriz de rúbrica</h3>
            <Rubrica respuestas={auditoria.rubrica_respuestas} />
          </div>

          {auditoria.observaciones_generales && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold">Observaciones del evaluador</h3>
              <p className="whitespace-pre-line rounded-xl border border-border bg-background p-3 text-sm">
                {auditoria.observaciones_generales}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function MisEvaluaciones({ usuario }) {
  const [dashboard, setDashboard] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [anio, setAnio] = useState('todos')

  const auditorId = usuario?.auth_user_id || usuario?.id || usuario?.usuario_id || ''

  useEffect(() => {
    if (!auditorId) {
      setError('No se encontró el identificador del auditor logueado.')
      setCargando(false)
      return
    }

    const cargar = async () => {
      setCargando(true)
      setError('')
      try {
        setDashboard(await obtenerDashboardAuditor(auditorId))
      } catch (err) {
        console.error('Error cargando las evaluaciones del auditor:', err)
        setError(err.message || 'No fue posible cargar tus evaluaciones.')
        setDashboard(null)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [auditorId, recarga])

  /** Solo las auditorías que ya tienen evaluación: el resto no aporta nada aquí. */
  const evaluadas = useMemo(
    () => (dashboard?.auditorias ?? []).filter((a) => a.evaluacion_id),
    [dashboard]
  )

  const anios = useMemo(
    () => [...new Set(evaluadas.map((a) => a.anio).filter(Boolean))].sort((a, b) => b - a),
    [evaluadas]
  )

  useAnioInicial(anios, (valor) => setAnio(String(valor)))

  const visibles = useMemo(
    () => (anio === 'todos' ? evaluadas : evaluadas.filter((a) => String(a.anio) === anio)),
    [evaluadas, anio]
  )

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Mis evaluaciones"
        subtitle="El detalle de cómo se evaluó cada una de tus auditorías, criterio por criterio."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-anio" className="text-xs text-white/80">
                Año
              </Label>
              <Select value={anio} onValueChange={setAnio} disabled={anios.length === 0}>
                <SelectTrigger
                  id="ev-anio"
                  className="w-40 border-white/25 bg-white/15 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los años</SelectItem>
                  {anios.map((valor) => (
                    <SelectItem key={valor} value={String(valor)}>
                      {valor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setRecarga((v) => v + 1)}
              disabled={cargando}
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <RefreshCw className={cargando ? 'animate-spin' : undefined} />
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          </div>
        }
      />

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {cargando && (
        <div className={SECTION_CARD}>
          <Cargando mensaje="Cargando tus evaluaciones…" />
        </div>
      )}

      {!cargando && !error && visibles.length === 0 && (
        <div className={cn(SECTION_CARD, EMPTY_STATE)}>
          {evaluadas.length === 0
            ? 'Todavía no hay evaluaciones de tus auditorías. Aparecerán aquí cuando el Centro de Gestión de la Calidad las registre.'
            : 'Ninguna evaluación en el año seleccionado.'}
        </div>
      )}

      {!cargando &&
        !error &&
        visibles.map((auditoria, i) => (
          <TarjetaEvaluacion
            key={auditoria.informe_id}
            auditoria={auditoria}
            // La primera abierta: con una sola evaluación, tener que desplegarla
            // es un clic de más para ver lo único que hay.
            abiertaPorDefecto={i === 0}
          />
        ))}
    </div>
  )
}
