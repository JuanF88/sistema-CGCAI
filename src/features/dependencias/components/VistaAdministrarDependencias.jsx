'use client'

/**
 * PANTALLA DE REFERENCIA del sistema de diseño.
 *
 * Muestra el patrón completo: primitivos de `@/components/ui`, tokens de clase
 * compartidos, y la capa `api/` para los datos. Sin CSS modules ni colores
 * crudos: todo sale del tema.
 */
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { Edit2, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, FieldGrid } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Badge } from '@/components/ui/badge'
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
import { DataTablePagination } from '@/components/ui/data-table-pagination'
import { usePagination } from '@/components/ui/use-pagination'
import { PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
import {
  PAGE_SHELL,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

import {
  actualizarDependencia,
  crearDependencia,
  eliminarDependencia,
  listarDependencias,
} from '@/features/dependencias/api/dependencias-api'

// La columna se llama `gestion` y sus valores no cambian; en pantalla son
// «procesos», con el nombre que les da el formato de auditoría. La lista es
// compartida con el cronograma del programa, que tiene una sección por proceso.
import { PROCESOS, procesoDe } from '@/lib/catalogos/procesos'
import { Spinner } from '@/components/ui/loader'

const FORM_INICIAL = { dependencia_id: null, nombre: '', gestion: 'otras' }

/** Sin acentos y en minúsculas, para buscar y ordenar de forma estable. */
const normalize = (s) =>
  (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** El aro pequeño y su texto, para la fila de una tabla que está cargando. */
function FilaCargando({ texto }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size="sm" />
      {texto}
    </span>
  )
}

export default function VistaAdministrarDependencias({ headerActions = null }) {
  const [dependencias, setDependencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [mostrarModal, setMostrarModal] = useState(false)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)

  const [filaAEliminar, setFilaAEliminar] = useState(null)
  const [eliminandoId, setEliminandoId] = useState(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        setCargando(true)
        setDependencias(await listarDependencias())
      } catch (error) {
        toast.error(error.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  const dependenciasVista = useMemo(() => {
    const q = normalize(busqueda)
    return dependencias
      .filter((d) => normalize(d.nombre).includes(q))
      .sort((a, b) => normalize(a.nombre).localeCompare(normalize(b.nombre)))
  }, [dependencias, busqueda])

  const paginacion = usePagination(dependenciasVista, 10)

  const stats = useMemo(() => {
    const porGestion = Object.fromEntries(
      PROCESOS.map((g) => [g.value, dependencias.filter((d) => (d.gestion || 'otras') === g.value).length])
    )
    return { total: dependencias.length, porGestion }
  }, [dependencias])

  /* ── acciones ── */

  const abrirNuevo = () => {
    setForm(FORM_INICIAL)
    setEditando(false)
    setMostrarModal(true)
  }

  const abrirEdicion = (row) => {
    setForm({
      dependencia_id: row.dependencia_id,
      nombre: row.nombre,
      gestion: row.gestion || 'otras',
    })
    setEditando(true)
    setMostrarModal(true)
  }

  const cerrarModal = () => {
    setForm(FORM_INICIAL)
    setEditando(false)
    setMostrarModal(false)
  }

  const handleSubmit = async () => {
    if (!form.nombre.trim()) {
      toast.error('El nombre es requerido.')
      return
    }

    const payload = { nombre: form.nombre.trim(), gestion: form.gestion || 'otras' }

    try {
      setGuardando(true)
      const data = editando
        ? await actualizarDependencia(form.dependencia_id, payload)
        : await crearDependencia(payload)

      setDependencias((prev) =>
        editando
          ? prev.map((d) => (d.dependencia_id === data.dependencia_id ? data : d))
          : [...prev, data]
      )

      toast.success(editando ? 'Dependencia actualizada' : 'Dependencia creada')
      cerrarModal()
    } catch (error) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmarEliminacion = async () => {
    if (!filaAEliminar) return

    try {
      setEliminandoId(filaAEliminar.dependencia_id)
      await eliminarDependencia(filaAEliminar.dependencia_id)

      setDependencias((prev) =>
        prev.filter((d) => d.dependencia_id !== filaAEliminar.dependencia_id)
      )
      toast.success('Dependencia eliminada')
      setFilaAEliminar(null)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setEliminandoId(null)
    }
  }

  /* ── render ── */

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Administrar Dependencias"
        subtitle="Dependencias y el proceso institucional al que pertenece cada una"
        actions={
          <>
            {headerActions}
            <Button
              onClick={abrirNuevo}
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <Plus />
              Nueva dependencia
            </Button>
          </>
        }
      />

      {/* KPIs por proceso.
          Ocho columnas solo a partir de 2xl (1536 px): en xl (1280) quedaban a
          127 px y los nombres de proceso no cabían. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        <InfoCard tone="blue" label="Total" value={stats.total} />
        {PROCESOS.map((g) => (
          <InfoCard
            key={g.value}
            tone={g.tono}
            label={g.corto}
            value={stats.porGestion[g.value] ?? 0}
          />
        ))}
      </section>

      {/* Tabla */}
      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <h2 className="text-sm font-semibold">Listado de dependencias</h2>

          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre…"
            aria-label="Buscar dependencia por nombre"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-56">Proceso</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cargando && <TableEmpty colSpan={4}>
              <FilaCargando texto="Cargando dependencias…" />
            </TableEmpty>}

            {!cargando && paginacion.total === 0 && (
              <TableEmpty colSpan={4}>
                {busqueda ? 'Ninguna dependencia coincide con la búsqueda.' : 'No hay dependencias registradas.'}
              </TableEmpty>
            )}

            {!cargando &&
              paginacion.pageItems.map((row) => {
                const proceso = procesoDe(row.gestion)
                return (
                  <TableRow key={row.dependencia_id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.dependencia_id}
                    </TableCell>
                    <TableCell className="font-medium">{row.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(STATUS_BADGE_TONES[proceso.badge])}>
                        {proceso.corto}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => abrirEdicion(row)}
                          title="Editar dependencia"
                        >
                          <Edit2 />
                          <span className="sr-only">Editar {row.nombre}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setFilaAEliminar(row)}
                          disabled={eliminandoId === row.dependencia_id}
                          title="Eliminar dependencia"
                        >
                          <Trash2 />
                          <span className="sr-only">Eliminar {row.nombre}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>

        <DataTablePagination pagination={paginacion} etiqueta="dependencias" />
      </section>

      {/* Crear / editar */}
      <FormDrawer
        open={mostrarModal}
        onOpenChange={(open) => (open ? null : cerrarModal())}
        title={editando ? 'Editar dependencia' : 'Nueva dependencia'}
        description="El nombre se guarda en mayúsculas para mantener el catálogo consistente."
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        submitting={guardando}
        submitLabel={editando ? 'Actualizar' : 'Crear dependencia'}
        className="max-w-[min(560px,calc(100vw-2rem))]"
      >
        <FormSection title="Datos de la dependencia">
          <FieldGrid columns={2}>
            <Field label="Nombre" htmlFor="dep-nombre" required wide>
              <Input
                id="dep-nombre"
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value.toUpperCase() }))}
                placeholder="NOMBRE DE LA DEPENDENCIA"
                autoFocus
              />
            </Field>

            <Field label="Proceso" htmlFor="dep-gestion" required wide>
              <Select
                value={form.gestion}
                onValueChange={(gestion) => setForm((prev) => ({ ...prev, gestion }))}
              >
                <SelectTrigger id="dep-gestion">
                  <SelectValue placeholder="Selecciona un proceso" />
                </SelectTrigger>
                <SelectContent>
                  {PROCESOS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>
        </FormSection>
      </FormDrawer>

      {/* Confirmar borrado */}
      <Dialog
        open={Boolean(filaAEliminar)}
        onOpenChange={(open) => (open ? null : setFilaAEliminar(null))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar dependencia</DialogTitle>
            <DialogDescription>
              Vas a eliminar <span className="font-medium text-foreground">{filaAEliminar?.nombre}</span>.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFilaAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarEliminacion}
              disabled={eliminandoId === filaAEliminar?.dependencia_id}
            >
              {eliminandoId === filaAEliminar?.dependencia_id ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
