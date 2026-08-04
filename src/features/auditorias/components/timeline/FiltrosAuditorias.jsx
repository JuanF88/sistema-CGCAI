'use client'

/**
 * Barra de filtros del listado de auditorías del administrador.
 *
 * Es solo presentación: recibe el estado y lo devuelve por `onFiltro`.
 */
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SECTION_CARD } from '@/components/ui/tokens'

export const FILTROS_INICIALES = {
  q: '',
  auditorTexto: '',
  dependencia: 'todas',
  auditor: 'todos',
  anio: 'todos',
  semestre: 'todos',
  estado: 'todos',
  desde: '',
}

export const ESTADOS_FILTRO = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'plan_pendiente', label: 'Plan pendiente' },
  { value: 'plan_enviado', label: 'Plan enviado' },
  { value: 'informe_pendiente', label: 'Informe pendiente' },
  { value: 'informe_completo', label: 'Informe completo' },
  { value: 'validado', label: 'Validado' },
  { value: 'no_validado', label: 'No validado' },
  { value: 'acta_compromiso_cargada', label: 'Carta de compromiso cargada' },
  { value: 'asistencia_cargada', label: 'Asistencia cargada' },
  { value: 'evaluacion_cargada', label: 'Evaluación cargada' },
  { value: 'acta_cargada', label: 'Acta cargada' },
  { value: 'listo_validar', label: 'Listo para validar' },
]

/** Checks rápidos: campo del flag → etiqueta. Se acumulan (AND). */
export const CHECKS_RAPIDOS = [
  { flag: 'actaCompOK', label: 'Carta compromiso' },
  { flag: 'asistenciaOK', label: 'Asistencia' },
  { flag: 'evaluacionOK', label: 'Evaluación' },
  { flag: 'actaOK', label: 'Acta' },
]

export function FiltrosAuditorias({
  filtros,
  onFiltro,
  checks,
  onCheck,
  dependencias,
  auditores,
  anios,
  mostradas,
  total,
}) {
  return (
    <section className={cn(SECTION_CARD, 'flex flex-col gap-4 p-4')}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput
          value={filtros.q}
          onChange={(v) => onFiltro('q', v)}
          placeholder="Buscar (dependencia, auditor, ID)"
          className="w-full sm:w-full lg:col-span-2"
        />

        <Input
          value={filtros.auditorTexto}
          onChange={(e) => onFiltro('auditorTexto', e.target.value)}
          placeholder="Filtrar por nombre de auditor"
        />

        <DatePicker
          value={filtros.desde}
          onChange={(v) => onFiltro('desde', v)}
          placeholder="Desde…"
          title="Auditorías desde esta fecha"
        />

        <Select value={filtros.dependencia} onValueChange={(v) => onFiltro('dependencia', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Dependencia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las dependencias</SelectItem>
            {dependencias.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtros.auditor} onValueChange={(v) => onFiltro('auditor', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Auditor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los auditores</SelectItem>
            {auditores.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtros.anio} onValueChange={(v) => onFiltro('anio', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los años</SelectItem>
            {anios.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtros.semestre} onValueChange={(v) => onFiltro('semestre', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Semestre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los semestres</SelectItem>
            <SelectItem value="1">Semestre 1</SelectItem>
            <SelectItem value="2">Semestre 2</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtros.estado} onValueChange={(v) => onFiltro('estado', v)}>
          <SelectTrigger className="lg:col-span-2">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS_FILTRO.map((e) => (
              <SelectItem key={e.value} value={e.value}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Solo con:
        </span>
        {CHECKS_RAPIDOS.map((c) => (
          <label
            key={c.flag}
            className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
          >
            <input
              type="checkbox"
              checked={Boolean(checks[c.flag])}
              onChange={(e) => onCheck(c.flag, e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]"
            />
            {c.label}
          </label>
        ))}

        <span className="ml-auto text-sm text-muted-foreground">
          {mostradas} de {total}
        </span>
      </div>
    </section>
  )
}
