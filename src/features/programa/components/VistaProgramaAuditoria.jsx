'use client'

/**
 * Programa de Auditoría Interna: listado por año y descarga del formato.
 */
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  CalendarRange,
  CheckCircle2,
  Download,
  Edit2,
  ListChecks,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { SearchInput } from '@/components/ui/search-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PAGE_SHELL,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'

import {
  actualizarPrograma,
  crearPrograma,
  eliminarPrograma,
  generarAuditoriasDelPrograma,
  listarProgramas,
  obtenerPrograma,
} from '@/features/programa/api/programa-api'
import { exportarProgramaExcel } from '@/features/programa/lib/exportar-programa'
import { useAnioInicial } from '@/hooks/useAnioInicial'
import { ProgramaDrawer } from './ProgramaDrawer'

const TONO_ESTADO = {
  borrador: 'neutral',
  aprobado: 'success',
  archivado: 'warning',
}

export default function VistaProgramaAuditoria({ soloLectura = false }) {
  const [programas, setProgramas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('todos')

  const [drawerAbierto, setDrawerAbierto] = useState(false)
  const [programaEnEdicion, setProgramaEnEdicion] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [descargandoId, setDescargandoId] = useState(null)
  const [cambiandoId, setCambiandoId] = useState(null)

  /** Programa cuya generación de auditorías se está confirmando. */
  const [aGenerar, setAGenerar] = useState(null)
  const [generando, setGenerando] = useState(false)
  /** Resultado de la última generación, para contarlo con detalle. */
  const [resultado, setResultado] = useState(null)

  const cargar = async () => {
    try {
      setCargando(true)
      setProgramas(await listarProgramas())
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const anios = useMemo(
    () => [...new Set(programas.map((p) => p.anio).filter(Boolean))].sort((a, b) => b - a),
    [programas]
  )

  useAnioInicial(anios, (anio) => setFiltroAnio(String(anio)))

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    return programas.filter((p) => {
      if (filtroAnio !== 'todos' && String(p.anio) !== filtroAnio) return false
      if (!q) return true

      return (
        p.nombre?.toLowerCase().includes(q) ||
        String(p.anio).includes(q) ||
        p.mes_auditoria?.toLowerCase().includes(q)
      )
    })
  }, [programas, busqueda, filtroAnio])

  // Sobre `filtrados`: las tarjetas resumen lo que se está viendo, no todo lo
  // que hay cargado.
  const stats = useMemo(
    () => ({
      total: filtrados.length,
      aprobados: filtrados.filter((p) => p.estado === 'aprobado').length,
      borradores: filtrados.filter((p) => p.estado === 'borrador').length,
    }),
    [filtrados]
  )

  /* ── Acciones ── */

  const abrirNuevo = () => {
    setProgramaEnEdicion(null)
    setDrawerAbierto(true)
  }

  /** Al editar hace falta la cabecera con sus dos listas, no la fila resumida. */
  const abrirEdicion = async (fila) => {
    try {
      setProgramaEnEdicion(await obtenerPrograma(fila.id))
      setDrawerAbierto(true)
    } catch (error) {
      toast.error(error.message)
    }
  }

  const guardar = async (datos) => {
    try {
      setGuardando(true)
      if (programaEnEdicion?.id) {
        await actualizarPrograma(programaEnEdicion.id, datos)
        toast.success('Programa actualizado')
      } else {
        await crearPrograma(datos)
        toast.success('Programa creado')
      }
      setDrawerAbierto(false)
      setProgramaEnEdicion(null)
      await cargar()
    } catch (error) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  /** La lista viene resumida; para exportar hay que traerlo completo. */
  const descargar = async (fila) => {
    try {
      setDescargandoId(fila.id)
      await exportarProgramaExcel(await obtenerPrograma(fila.id))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setDescargandoId(null)
    }
  }

  /**
   * Aprueba un programa o lo devuelve a borrador.
   *
   * Hay que traerlo completo antes de guardarlo: el `PUT` reescribe el
   * cronograma y la distribución con lo que reciba, así que mandar solo la
   * cabecera los borraría.
   */
  const cambiarEstado = async (fila, estado) => {
    try {
      setCambiandoId(fila.id)
      const completo = await obtenerPrograma(fila.id)

      await actualizarPrograma(fila.id, {
        ...completo,
        estado,
        // El formato pide la fecha en el pie; si no hay ninguna, se pone hoy.
        fecha_aprobacion:
          estado === 'aprobado' && !completo.fecha_aprobacion
            ? new Date().toISOString().slice(0, 10)
            : completo.fecha_aprobacion,
      })

      toast.success(estado === 'aprobado' ? 'Programa aprobado' : 'Programa devuelto a borrador')
      await cargar()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setCambiandoId(null)
    }
  }

  /**
   * Crea las auditorías del programa aprobado.
   *
   * El resultado se muestra en un diálogo y no en un aviso: puede traer una
   * lista de líneas que no se pudieron crear, y eso no se lee en tres segundos.
   */
  const generar = async () => {
    if (!aGenerar) return

    try {
      setGenerando(true)
      const res = await generarAuditoriasDelPrograma(aGenerar.id)

      setResultado({ ...res, programa: aGenerar })
      setAGenerar(null)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setGenerando(false)
    }
  }

  const confirmarEliminacion = async () => {
    if (!aEliminar) return
    try {
      await eliminarPrograma(aEliminar.id)
      toast.success('Programa eliminado')
      setAEliminar(null)
      await cargar()
    } catch (error) {
      toast.error(error.message)
    }
  }

  /* ── Render ── */

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        icon={<CalendarRange />}
        title="Programa de Auditoría"
        subtitle="Formato PE-GS-2.2.1-FOR-7 · planificación anual de las auditorías internas"
        actions={
          !soloLectura && (
            <Button
              onClick={abrirNuevo}
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <Plus />
              Nuevo programa
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="📅" label="Programas" value={stats.total} tone="blue" />
        <StatCard icon="✅" label="Aprobados" value={stats.aprobados} tone="green" />
        <StatCard icon="📝" label="Borradores" value={stats.borradores} tone="gray" />
      </div>

      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <h2 className="text-sm font-semibold">Programas registrados</h2>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filtroAnio} onValueChange={setFiltroAnio}>
              <SelectTrigger className="w-36" aria-label="Filtrar por año">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los años</SelectItem>
                {anios.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchInput
              value={busqueda}
              onChange={setBusqueda}
              placeholder="Buscar por nombre o mes…"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">Año</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-40">Mes</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-72 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cargando && <TableEmpty colSpan={5}>Cargando programas…</TableEmpty>}

            {!cargando && filtrados.length === 0 && (
              <TableEmpty colSpan={5}>
                {busqueda || filtroAnio !== 'todos'
                  ? 'Ningún programa coincide con los filtros.'
                  : 'Todavía no hay programas registrados.'}
              </TableEmpty>
            )}

            {!cargando &&
              filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{p.anio}</TableCell>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.mes_auditoria || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('capitalize', STATUS_BADGE_TONES[TONO_ESTADO[p.estado]])}
                    >
                      {p.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => descargar(p)}
                        disabled={descargandoId === p.id}
                        title="Descargar el formato en Excel"
                      >
                        <Download />
                        {descargandoId === p.id ? 'Generando…' : 'Excel'}
                      </Button>

                      {/* Solo con el programa aprobado: un borrador se sigue
                          editando y dejaría auditorías colgando de un plan que
                          va a cambiar. */}
                      {!soloLectura && p.estado === 'aprobado' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAGenerar(p)}
                          title="Crear las auditorías del cronograma"
                        >
                          <ListChecks />
                          Generar auditorías
                        </Button>
                      )}

                      {!soloLectura && p.estado !== 'archivado' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            cambiarEstado(p, p.estado === 'aprobado' ? 'borrador' : 'aprobado')
                          }
                          disabled={cambiandoId === p.id}
                          title={
                            p.estado === 'aprobado'
                              ? 'Devolver a borrador'
                              : 'Marcar como programa aprobado del año'
                          }
                          className={
                            p.estado === 'aprobado'
                              ? 'text-muted-foreground'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40'
                          }
                        >
                          {p.estado === 'aprobado' ? <Undo2 /> : <CheckCircle2 />}
                          {cambiandoId === p.id
                            ? 'Guardando…'
                            : p.estado === 'aprobado'
                              ? 'Borrador'
                              : 'Aprobar'}
                        </Button>
                      )}

                      {!soloLectura && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => abrirEdicion(p)}
                            title="Editar programa"
                          >
                            <Edit2 />
                            <span className="sr-only">Editar {p.nombre}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAEliminar(p)}
                            title="Eliminar programa"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                            <span className="sr-only">Eliminar {p.nombre}</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </section>

      <ProgramaDrawer
        open={drawerAbierto}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setDrawerAbierto(false)
            setProgramaEnEdicion(null)
          }
        }}
        programa={programaEnEdicion}
        onGuardar={guardar}
        guardando={guardando}
      />

      {/* Confirmar la generación */}
      <Dialog open={Boolean(aGenerar)} onOpenChange={(o) => (o ? null : setAGenerar(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generar auditorías</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Se creará una auditoría por cada dependencia del cronograma de{' '}
                  <span className="font-medium text-foreground">
                    {aGenerar?.nombre} ({aGenerar?.anio})
                  </span>
                  , con fecha del{' '}
                  <span className="font-medium text-foreground">
                    1 de {(aGenerar?.mes_auditoria || '').toLowerCase() || '—'} de {aGenerar?.anio}
                  </span>
                  . El primer auditor de cada línea queda como responsable y el resto como
                  acompañantes.
                </p>
                <p>
                  La fecha exacta se puede ajustar después en «Administrar auditorías». No se envían
                  correos: el aviso a cada auditor se hace cuando decidas.
                </p>
                <p>
                  Puedes volver a pulsarlo más adelante; solo se crearán las que falten.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAGenerar(null)} disabled={generando}>
              Cancelar
            </Button>
            <Button onClick={generar} disabled={generando}>
              <ListChecks />
              {generando ? 'Generando…' : 'Generar auditorías'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado de la generación */}
      <Dialog open={Boolean(resultado)} onOpenChange={(o) => (o ? null : setResultado(null))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {resultado?.creadas
                ? `Se crearon ${resultado.creadas} auditoría${resultado.creadas === 1 ? '' : 's'}`
                : 'No se creó ninguna auditoría'}
            </DialogTitle>
            <DialogDescription>
              {resultado?.programa?.nombre} ({resultado?.programa?.anio}) · fecha {resultado?.fecha}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {resultado?.yaCreadas > 0 && (
              <p className="text-muted-foreground">
                {resultado.yaCreadas} dependencia{resultado.yaCreadas === 1 ? '' : 's'} ya tenía
                {resultado.yaCreadas === 1 ? '' : 'n'} auditoría de este programa y se
                {resultado.yaCreadas === 1 ? ' omitió' : ' omitieron'}.
              </p>
            )}

            {resultado?.problemas?.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-medium text-destructive">
                  {resultado.problemas.length} línea
                  {resultado.problemas.length === 1 ? '' : 's'} sin crear:
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-3 text-xs">
                  {resultado.problemas.map((problema, i) => (
                    <li key={i}>· {problema}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Corrige el cronograma o el catálogo y vuelve a generar; las ya creadas no se
                  duplican.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setResultado(null)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(aEliminar)} onOpenChange={(o) => (o ? null : setAEliminar(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar programa</DialogTitle>
            <DialogDescription>
              Vas a eliminar{' '}
              <span className="font-medium text-foreground">
                {aEliminar?.nombre} ({aEliminar?.anio})
              </span>{' '}
              con su cronograma y su distribución. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAEliminar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarEliminacion}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
