'use client'

/**
 * Alta de una auditoría: dependencia, auditor responsable y fecha.
 *
 * Tanto las dependencias como los auditores se eligen de una rejilla filtrable
 * en vez de un desplegable: las listas son largas y de los auditores interesa
 * ver el correo y el área antes de decidir.
 */
import { useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/ui/search-input'
import { EMPTY_STATE } from '@/components/ui/tokens'

/** Tarjeta seleccionable de la rejilla. */
function OpcionCard({ seleccionada, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg border p-2.5 text-left text-sm transition-colors',
        seleccionada
          ? 'border-primary bg-primary/10 font-medium'
          : 'border-border bg-card hover:bg-accent',
        className
      )}
    >
      {children}
    </button>
  )
}

/** Ficha del auditor elegido, para confirmar antes de crear. */
function ResumenAuditor({ auditor }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Auditor seleccionado
          </p>
          <h4 className="text-base font-bold">
            {auditor.nombre || ''} {auditor.apellido || ''}
          </h4>
        </div>
        <Badge>{auditor.tipo_personal || 'Sin tipo'}</Badge>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Información personal
          </span>
          <span>Correo: {auditor.email || 'No registrado'}</span>
          <span>Celular: {auditor.celular || 'No registrado'}</span>
          <span>Estado: {auditor.estado || 'No definido'}</span>
        </div>

        <div className="flex flex-col gap-0.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Perfil profesional
          </span>
          <span>Área: {auditor.dependencias?.nombre || 'Sin área asignada'}</span>
          <span>Tipo de estudio: {auditor.tipo_estudio || 'No registrado'}</span>
          <span>Estudios: {auditor.estudios || 'No registrados'}</span>
        </div>
      </div>
    </div>
  )
}

export function ModalCrearAuditoria({
  open,
  onOpenChange,
  dependencias,
  auditores,
  valores,
  onCambio,
  onCrear,
  creando,
}) {
  const [buscarDependencia, setBuscarDependencia] = useState('')
  const [buscarAuditor, setBuscarAuditor] = useState('')

  const dependenciasFiltradas = useMemo(() => {
    const term = buscarDependencia.trim().toLowerCase()
    if (!term) return dependencias
    return dependencias.filter((dep) => (dep.nombre || '').toLowerCase().includes(term))
  }, [dependencias, buscarDependencia])

  const auditoresFiltrados = useMemo(() => {
    const term = buscarAuditor.trim().toLowerCase()
    if (!term) return auditores

    return auditores.filter((a) =>
      [
        a.nombre,
        a.apellido,
        a.email,
        a.celular,
        a.tipo_personal,
        a.tipo_estudio,
        a.estudios,
        a.dependencias?.nombre,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    )
  }, [auditores, buscarAuditor])

  const auditorElegido = useMemo(
    () => auditores.find((a) => String(a.usuario_id) === String(valores.usuario_id)) || null,
    [auditores, valores.usuario_id]
  )

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva auditoría"
      description="Asigna un auditor y una dependencia, y fija la fecha de la auditoría."
      onSubmit={(e) => {
        e.preventDefault()
        onCrear()
      }}
      submitting={creando}
      submitLabel="Crear auditoría"
    >
      <FormSection title="Asignación" description="Sobre qué dependencia y con qué auditor.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Dependencia</Label>
            <SearchInput
              value={buscarDependencia}
              onChange={setBuscarDependencia}
              placeholder="Escribe para filtrar dependencias"
              className="w-full sm:w-full"
            />

            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {dependenciasFiltradas.map((dep) => (
                <OpcionCard
                  key={dep.dependencia_id}
                  seleccionada={String(valores.dependencia_id) === String(dep.dependencia_id)}
                  onClick={() => onCambio('dependencia_id', String(dep.dependencia_id))}
                >
                  {dep.nombre}
                </OpcionCard>
              ))}

              {dependenciasFiltradas.length === 0 && (
                <p className={cn(EMPTY_STATE, 'sm:col-span-2')}>
                  No se encontraron dependencias con ese criterio.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Auditor responsable</Label>
            <SearchInput
              value={buscarAuditor}
              onChange={setBuscarAuditor}
              placeholder="Buscar por nombre, correo, área o perfil"
              className="w-full sm:w-full"
            />

            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {auditoresFiltrados.map((a) => (
                <OpcionCard
                  key={a.usuario_id}
                  seleccionada={String(valores.usuario_id) === String(a.usuario_id)}
                  onClick={() => onCambio('usuario_id', String(a.usuario_id))}
                  className="p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm">
                      {a.etiqueta || `${a.nombre || ''} ${a.apellido || ''}`}
                    </strong>
                    <Badge variant="secondary" className="shrink-0">
                      {a.tipo_personal || 'Sin tipo'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.email || 'Sin correo'}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.dependencias?.nombre || 'Sin área asignada'}
                  </p>
                </OpcionCard>
              ))}

              {auditoresFiltrados.length === 0 && (
                <p className={cn(EMPTY_STATE, 'sm:col-span-2')}>
                  No se encontraron auditores con ese criterio.
                </p>
              )}
            </div>
          </div>

          {auditorElegido && <ResumenAuditor auditor={auditorElegido} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crear-fecha">Fecha de auditoría</Label>
            <DatePicker
              id="crear-fecha"
              value={valores.fecha_auditoria}
              onChange={(v) => onCambio('fecha_auditoria', v)}
            />
          </div>
        </div>
      </FormSection>
    </FormDrawer>
  )
}
