'use client'

/**
 * Registro de actividad: quién entra y quién hace qué.
 *
 * Es una vista de auditoría, así que está escrita para una pregunta concreta:
 * «¿quién tocó esto y cuándo?». De ahí tres decisiones:
 *
 *  - Se filtra en el servidor, no en la pantalla. La tabla crece sin tope y
 *    traerla entera para filtrarla dejaría de funcionar al mes.
 *  - Cada fila se puede abrir para ver el antes y el después de lo que cambió.
 *    Sin eso, «modificó el informe #352» no sirve de nada.
 *  - Lo que se exporta es lo que se está viendo, con los filtros puestos, y
 *    pidiendo las páginas que falten: un acta de auditoría se entrega entera.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePlus2,
  FileUp,
  KeyRound,
  LogIn,
  Pencil,
  RotateCw,
  Trash2,
  UserPlus,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, HeaderStat } from '@/components/ui/page-header'
import { Cargando } from '@/components/ui/loader'
import { EMPTY_STATE, SECTION_CARD } from '@/components/ui/tokens'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listarActividad } from '@/features/registro/api/registro-api'
import {
  GRUPOS,
  describirActividad,
  entidadesDelGrupo,
  etiquetaCampo,
  recortar,
} from '@/features/registro/lib/describir-actividad'

const TIPOS = [
  { value: 'todos', label: 'Todo' },
  { value: 'sesion', label: 'Accesos' },
  { value: 'dato', label: 'Cambios de datos' },
  { value: 'archivo', label: 'Archivos' },
]

const ACCIONES = [
  { value: 'todas', label: 'Cualquier acción' },
  { value: 'crear', label: 'Creó' },
  { value: 'modificar', label: 'Modificó' },
  { value: 'eliminar', label: 'Eliminó' },
  { value: 'subir', label: 'Subió un archivo' },
  { value: 'entrar', label: 'Entró' },
  { value: 'salir', label: 'Salió' },
]

const ICONOS = {
  crear: FilePlus2,
  modificar: Pencil,
  eliminar: Trash2,
  subir: FileUp,
  reemplazar: FileUp,
  entrar: LogIn,
  salir: LogIn,
  // Altas, bajas y cambios de cuenta, que Supabase Auth nombra a su manera.
  user_signedup: UserPlus,
  user_invited: UserPlus,
  user_deleted: Trash2,
  user_modified: Pencil,
  user_updated_password: KeyRound,
  user_recovery_requested: KeyRound,
}

const TONO_CLASES = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  slate: 'bg-muted text-muted-foreground',
}

const POR_PAGINA = 50

/** Hoy y hace un mes, en 'YYYY-MM-DD' locales. */
const diaLocal = (fecha) => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

const haceUnMes = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return diaLocal(d)
}

const fechaHora = (iso) =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function VistaRegistroActividad() {
  const [filas, setFilas] = useState([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [abierta, setAbierta] = useState(null)

  const [usuarios, setUsuarios] = useState([])

  const [tipo, setTipo] = useState('todos')
  const [accion, setAccion] = useState('todas')
  const [grupo, setGrupo] = useState('todos')
  const [actor, setActor] = useState('todos')
  const [desde, setDesde] = useState(haceUnMes)
  const [hasta, setHasta] = useState(() => diaLocal(new Date()))
  const [pagina, setPagina] = useState(1)

  const filtros = useMemo(
    () => ({
      tipo: tipo === 'todos' ? '' : tipo,
      accion: accion === 'todas' ? '' : accion,
      entidades: grupo === 'todos' ? '' : entidadesDelGrupo(grupo).join(','),
      actor: actor === 'todos' ? '' : actor,
      desde,
      hasta,
      porPagina: POR_PAGINA,
    }),
    [tipo, accion, grupo, actor, desde, hasta]
  )

  /* Los filtros se cambian a mano, así que al cambiarlos se vuelve a la 1:
     quedarse en la página 7 de un filtro nuevo enseña una lista vacía. */
  useEffect(() => {
    setPagina(1)
  }, [filtros])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const datos = await listarActividad({ ...filtros, pagina })
      setFilas(datos.filas)
      setTotal(datos.total)
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el registro.')
    } finally {
      setCargando(false)
    }
  }, [filtros, pagina])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Para el filtro por persona. Se leen todos los usuarios y no sólo los que
  // aparecen en el registro: así se puede comprobar que alguien NO ha hecho
  // nada, que en una auditoría es una respuesta tan válida como la contraria.
  useEffect(() => {
    supabase
      .from('usuarios')
      .select('usuario_id, nombre, apellido, rol')
      .order('nombre')
      .then(({ data }) => {
        if (data) setUsuarios(data)
      })
  }, [])

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const exportar = async () => {
    setExportando(true)
    try {
      const { exportarRegistroActividad } = await import(
        '@/features/registro/lib/exportar-registro'
      )
      await exportarRegistroActividad({
        filtros,
        total,
        pedirPagina: (n) => listarActividad({ ...filtros, pagina: n, porPagina: 200 }),
      })
    } catch (err) {
      console.error('Exportar registro:', err)
      toast.error(err?.message || 'No se pudo exportar el registro.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Auditoría del sistema"
        title="Registro de actividad"
        subtitle="Quién entra al sistema y qué hace cada persona: cambios en los informes y los hallazgos, archivos subidos y accesos."
        stats={
          <>
            <HeaderStat label="Asientos en el filtro" value={total.toLocaleString('es-CO')} />
            <HeaderStat label="Página" value={`${pagina} de ${paginas}`} />
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={cargar} disabled={cargando}>
              <RotateCw className={cn(cargando && 'animate-spin')} />
              Actualizar
            </Button>
            <Button onClick={exportar} disabled={exportando || !total}>
              <Download />
              {exportando ? 'Exportando…' : 'Exportar a Excel'}
            </Button>
          </div>
        }
      />

      {/* ── Filtros ── */}
      <section className={cn(SECTION_CARD, 'p-4')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Campo etiqueta="Qué">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo etiqueta="Acción">
            <Select value={accion} onValueChange={setAccion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCIONES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo etiqueta="Área">
            <Select value={grupo} onValueChange={setGrupo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {GRUPOS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo etiqueta="Persona">
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Cualquiera</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.usuario_id} value={String(u.usuario_id)}>
                    {u.nombre} {u.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo etiqueta="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>

          <Campo etiqueta="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
        </div>
      </section>

      {/* ── Lista ── */}
      <section className={cn(SECTION_CARD, 'overflow-hidden')}>
        {cargando && !filas.length ? (
          <Cargando mensaje="Leyendo el registro…" />
        ) : error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !filas.length ? (
          <p className={cn(EMPTY_STATE, 'm-6')}>
            No hay actividad registrada con estos filtros. Si acabas de instalar el registro, sólo
            constará lo que pase a partir de ahora.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filas.map((fila) => (
              <Asiento
                key={fila.id}
                fila={fila}
                abierta={abierta === fila.id}
                onAlternar={() => setAbierta(abierta === fila.id ? null : fila.id)}
              />
            ))}
          </ul>
        )}

        {total > POR_PAGINA && (
          <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de{' '}
              {total.toLocaleString('es-CO')}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPagina((n) => Math.max(1, n - 1))}
                disabled={pagina === 1 || cargando}
              >
                <ChevronLeft />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPagina((n) => Math.min(paginas, n + 1))}
                disabled={pagina >= paginas || cargando}
              >
                Siguiente
                <ChevronRight />
              </Button>
            </div>
          </footer>
        )}
      </section>

      <p className="px-1 text-xs text-muted-foreground">
        El registro se escribe en la base de datos con disparadores, así que recoge cualquier
        cambio sin importar desde dónde se haga. Sólo se puede leer: ni la aplicación ni quien
        entre en ella puede modificarlo o borrarlo. Las contraseñas nunca se guardan aquí.
      </p>
    </div>
  )
}

function Campo({ etiqueta, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{etiqueta}</span>
      {children}
    </label>
  )
}

function Asiento({ fila, abierta, onAlternar }) {
  const { actor, frase, detalle, tono, grupo } = describirActividad(fila)
  const Icono = ICONOS[fila.accion] ?? Pencil
  const tieneDetalle = Boolean(fila.datos_antes || fila.datos_despues)

  return (
    <li>
      <button
        type="button"
        onClick={tieneDetalle ? onAlternar : undefined}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left',
          tieneDetalle && 'cursor-pointer hover:bg-muted/40'
        )}
        aria-expanded={tieneDetalle ? abierta : undefined}
      >
        <span
          className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', TONO_CLASES[tono])}
          aria-hidden="true"
        >
          <Icono className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm">
            <strong className="font-semibold">{actor}</strong> {frase}
          </span>
          {detalle && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detalle}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden rounded-full border border-border px-2 py-0.5 sm:inline">
            {grupo}
          </span>
          <time dateTime={fila.ocurrido_at} className="tabular-nums">
            {fechaHora(fila.ocurrido_at)}
          </time>
          {tieneDetalle && (
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', abierta && 'rotate-180')}
              aria-hidden="true"
            />
          )}
        </span>
      </button>

      {abierta && tieneDetalle && <Detalle fila={fila} />}
    </li>
  )
}

/**
 * El antes y el después, campo por campo.
 *
 * Es la razón de ser de la vista: saber que alguien «modificó el informe» no
 * responde nada; saber que cambió las conclusiones y de qué a qué, sí.
 */
function Detalle({ fila }) {
  const claves = [
    ...new Set([
      ...(fila.campos ?? []),
      ...Object.keys(fila.datos_despues ?? {}),
      ...Object.keys(fila.datos_antes ?? {}),
    ]),
  ]

  return (
    <div className="border-t border-border bg-muted/30 px-4 py-3">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr_1fr]">
        <dt className="hidden text-xs font-semibold uppercase text-muted-foreground sm:block">
          Campo
        </dt>
        <dt className="hidden text-xs font-semibold uppercase text-muted-foreground sm:block">
          Antes
        </dt>
        <dt className="hidden text-xs font-semibold uppercase text-muted-foreground sm:block">
          Después
        </dt>

        {claves.map((clave) => (
          <div key={clave} className="grid gap-x-6 sm:col-span-3 sm:grid-cols-subgrid">
            <dt className="text-xs font-medium">{etiquetaCampo(clave)}</dt>
            <dd className="text-xs text-muted-foreground line-through decoration-rose-400/60">
              {recortar(fila.datos_antes?.[clave], 140) || '—'}
            </dd>
            <dd className="text-xs">{recortar(fila.datos_despues?.[clave], 140) || '—'}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
        <span>Asiento #{fila.id}</span>
        <span>Origen: {fila.origen}</span>
        {fila.actor_rol && <span>Rol: {fila.actor_rol}</span>}
        {fila.ip && <span>IP: {fila.ip}</span>}
        {fila.registro_id && <span>Registro: {fila.registro_id}</span>}
      </p>
    </div>
  )
}
