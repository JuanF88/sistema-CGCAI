'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  Building2,
  Edit2,
  Eye,
  EyeOff,
  GraduationCap,
  Phone,
  Plus,
  Send,
  Trash2,
  UserRound,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { Input, Textarea } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
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
import {
  PAGE_SHELL,
  STATUS_BADGE_TONES,
  TABLE_CONTAINER,
  TABLE_TOOLBAR,
} from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  enviarCredenciales,
  listarUsuarios,
} from '@/features/usuarios/api/usuarios-api'
import { listarDependencias } from '@/features/dependencias/api/dependencias-api'

const FORMULARIO_INICIAL = {
  usuario_id: null,
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: '',
  estado: 'activo',
  tipo_personal: '',
  dependencia_id: '',
  estudios: '',
  tipo_estudio: '',
  celular: '',
}

const ROLES = [
  { value: 'auditor', label: 'Auditor' },
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'visualizador', label: 'Visualizador' },
]

const TIPOS_PERSONAL = [
  { value: 'ops', label: 'OPS' },
  { value: 'docente', label: 'Docente' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'otro', label: 'Otro' },
]

const TIPOS_ESTUDIO = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'magister', label: 'Magíster' },
  { value: 'profesional especializado', label: 'Profesional especializado' },
  { value: 'doctor', label: 'Doctor' },
]

const ESTADOS = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
]

/** Tono de badge por rol. */
const TONO_ROL = {
  admin: 'danger',
  auditor: 'accent',
  gestor: 'warning',
  visualizador: 'info',
}

const normalize = (s) =>
  (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Cabecera de sección dentro del formulario; se repite 3 veces. */
export default function VistaAdministrarUsuarios({ headerActions = null }) {
  const [usuarios, setUsuarios] = useState([])
  const [dependencias, setDependencias] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editando, setEditando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  const [enviandoCredencialesId, setEnviandoCredencialesId] = useState(null)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null)

  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dataUsuarios, dataDependencias] = await Promise.all([
          listarUsuarios(),
          listarDependencias(),
        ])
        setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : [])
        setDependencias(Array.isArray(dataDependencias) ? dataDependencias : [])
      } catch (error) {
        toast.error(error.message || 'Error cargando datos iniciales')
      } finally {
        setCargando(false)
      }
    }
    fetchData()
  }, [])

  const getDependenciaNombre = (dependenciaId) => {
    if (!dependenciaId) return 'Sin asignar'
    const match = dependencias.find((dep) => String(dep.dependencia_id) === String(dependenciaId))
    return match?.nombre || 'Sin asignar'
  }

  /* ── acciones ── */

  const enviarCredencialesAhora = async (usuario) => {
    if (!usuario?.usuario_id) {
      toast.error('No se encontró el ID del usuario.')
      return
    }
    if ((usuario?.estado || '').toLowerCase() !== 'activo') {
      toast.error('No se pueden enviar credenciales a usuarios inactivos.')
      return
    }

    try {
      setEnviandoCredencialesId(usuario.usuario_id)
      const data = await enviarCredenciales(usuario.usuario_id)

      if (!data?.ok) {
        toast.error(data?.notification?.message || 'No se pudo enviar el correo.')
        return
      }
      toast.success('Credenciales enviadas por correo.')
    } catch (error) {
      toast.error(
        error?.details?.notification?.message || error?.message || 'Error enviando credenciales.'
      )
    } finally {
      setEnviandoCredencialesId(null)
    }
  }

  const setCampo = (name, value) => setFormulario((prev) => ({ ...prev, [name]: value }))

  const validarFormulario = () => {
    const error =
      (!formulario.nombre.trim() && 'El nombre es obligatorio.') ||
      (!formulario.apellido.trim() && 'El apellido es obligatorio.') ||
      (!formulario.email.trim() && 'El correo es obligatorio.') ||
      (!formulario.rol && 'Selecciona un rol.') ||
      (!editando &&
        !formulario.password.trim() &&
        'La contraseña es obligatoria para crear el usuario.')

    if (error) {
      toast.error(error)
      return false
    }
    return true
  }

  const buildPayload = () => {
    const payload = {
      nombre: formulario.nombre.trim(),
      apellido: formulario.apellido.trim(),
      email: formulario.email.trim(),
      rol: formulario.rol,
      estado: formulario.estado || 'activo',
      tipo_personal: formulario.tipo_personal || null,
      dependencia_id: formulario.dependencia_id ? Number(formulario.dependencia_id) : null,
      estudios: formulario.estudios.trim() || null,
      tipo_estudio: formulario.tipo_estudio || null,
      celular: formulario.celular.trim() || null,
    }

    // Solo se envía la contraseña al crear, o al editar si escribieron una nueva.
    if (!editando || formulario.password.trim()) {
      payload.password = formulario.password
    }

    return payload
  }

  const confirmarEliminacion = async () => {
    if (!usuarioAEliminar) return

    try {
      setEliminandoId(usuarioAEliminar.usuario_id)
      await eliminarUsuario(usuarioAEliminar.usuario_id)
      setUsuarios((prev) => prev.filter((u) => u.usuario_id !== usuarioAEliminar.usuario_id))
      toast.success('Usuario eliminado')
      setUsuarioAEliminar(null)
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar')
    } finally {
      setEliminandoId(null)
    }
  }

  const handleSubmit = async () => {
    if (!validarFormulario()) return

    try {
      setGuardando(true)

      if (editando && !formulario.usuario_id) {
        toast.error('No se especificó el ID del usuario a actualizar.')
        return
      }

      const data = editando
        ? await actualizarUsuario(formulario.usuario_id, buildPayload())
        : await crearUsuario(buildPayload())

      setUsuarios((prev) =>
        editando
          ? prev.map((u) => (u.usuario_id === data.usuario_id ? data : u))
          : [...prev, data]
      )

      cerrarModal()
      toast.success(editando ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito')
    } catch (error) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  const abrirEdicion = (usuario) => {
    setFormulario({
      usuario_id: usuario.usuario_id ?? null,
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      email: usuario.email || '',
      // La API nunca devuelve la contraseña: se deja vacía y solo se envía si
      // el admin escribe una nueva.
      password: '',
      rol: usuario.rol || '',
      estado: usuario.estado || 'activo',
      tipo_personal: usuario.tipo_personal || '',
      dependencia_id: usuario.dependencia_id ? String(usuario.dependencia_id) : '',
      estudios: usuario.estudios || '',
      tipo_estudio: usuario.tipo_estudio || '',
      celular: usuario.celular || '',
    })
    setEditando(true)
    setMostrarModal(true)
    setMostrarPassword(false)
  }

  const abrirNuevo = () => {
    setFormulario(FORMULARIO_INICIAL)
    setEditando(false)
    setMostrarModal(true)
    setMostrarPassword(false)
  }

  const cerrarModal = () => {
    setFormulario(FORMULARIO_INICIAL)
    setMostrarModal(false)
    setEditando(false)
    setMostrarPassword(false)
  }

  /* ── datos derivados ── */

  const usuariosVista = useMemo(() => {
    const q = normalize(busqueda)
    if (!q) return usuarios

    return usuarios.filter((u) => {
      const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`
      return (
        normalize(nombreCompleto).includes(q) ||
        normalize(u.email).includes(q) ||
        normalize(u.rol).includes(q) ||
        normalize(u.estado).includes(q) ||
        normalize(u.tipo_personal).includes(q) ||
        normalize(u.tipo_estudio).includes(q) ||
        normalize(u.estudios).includes(q) ||
        normalize(u.celular).includes(q) ||
        normalize(getDependenciaNombre(u.dependencia_id)).includes(q)
      )
    })
  }, [usuarios, busqueda, dependencias]) // eslint-disable-line react-hooks/exhaustive-deps

  const paginacion = usePagination(usuariosVista, 30)

  const stats = useMemo(() => {
    const total = usuarios.length
    return {
      total,
      activos: usuarios.filter((u) => u.estado === 'activo').length,
      inactivos: usuarios.filter((u) => u.estado === 'inactivo').length,
      auditores: usuarios.filter((u) => u.rol === 'auditor').length,
      admins: usuarios.filter((u) => u.rol === 'admin').length,
      gestores: usuarios.filter((u) => u.rol === 'gestor').length,
    }
  }, [usuarios])

  const porcentajeActivos =
    stats.total > 0 ? Math.round((stats.activos / stats.total) * 100) : 0

  /* ── render ── */

  return (
    <div className={PAGE_SHELL}>
      <PageHeader
        title="Administrar Usuarios"
        subtitle="Gestión de usuarios del sistema de auditoría"
        actions={
          <>
            {headerActions}
            <Button
              onClick={abrirNuevo}
              className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25"
            >
              <Plus />
              Nuevo usuario
            </Button>
          </>
        }
      />

      {/* Seis columnas solo a partir de 2xl (1536 px). En xl (1280) cada
          tarjeta bajaba a unos 165 px y «Administradores» se salía. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
        <InfoCard tone="blue" label="Total usuarios" value={stats.total} />
        <InfoCard
          tone="green"
          label="Activos"
          value={stats.activos}
          total={stats.total}
          percent={porcentajeActivos}
        />
        <InfoCard tone="orange" label="Inactivos" value={stats.inactivos} />
        <InfoCard tone="purple" label="Auditores" value={stats.auditores} />
        <InfoCard tone="indigo" label="Administradores" value={stats.admins} />
        <InfoCard tone="cyan" label="Gestores" value={stats.gestores} />
      </section>

      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Listado de usuarios</h2>
            <Badge variant="secondary">{usuariosVista.length} registros</Badge>
          </div>

          <SearchInput
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre, correo, rol, tipo o área…"
            aria-label="Buscar usuario"
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-32">Rol</TableHead>
              <TableHead className="w-32">Tipo</TableHead>
              <TableHead>Organismo / Área</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cargando && <TableEmpty colSpan={8}>Cargando usuarios…</TableEmpty>}

            {!cargando && paginacion.total === 0 && (
              <TableEmpty colSpan={8}>
                {busqueda
                  ? 'Ningún usuario coincide con la búsqueda.'
                  : 'No hay usuarios registrados.'}
              </TableEmpty>
            )}

            {!cargando &&
              paginacion.pageItems.map((row) => {
                const activo = (row.estado || '').toLowerCase() === 'activo'
                const nombre = `${row.nombre || ''} ${row.apellido || ''}`.trim() || 'Sin nombre'

                return (
                  <TableRow key={row.usuario_id}>
                    <TableCell>
                      <Badge variant="secondary" className="tabular-nums">
                        #{row.usuario_id}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{nombre}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.email || 'Sin correo'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(STATUS_BADGE_TONES[TONO_ROL[row.rol] ?? 'neutral'], 'capitalize')}
                      >
                        {row.rol || 'sin rol'}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {row.tipo_personal || 'Sin definir'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getDependenciaNombre(row.dependencia_id)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          STATUS_BADGE_TONES[activo ? 'success' : 'neutral'],
                          'capitalize'
                        )}
                      >
                        {row.estado || 'sin estado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => abrirEdicion(row)}
                          title="Editar usuario"
                        >
                          <Edit2 />
                          <span className="sr-only">Editar {nombre}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => enviarCredencialesAhora(row)}
                          disabled={enviandoCredencialesId === row.usuario_id || !activo}
                          title={
                            activo
                              ? 'Enviar credenciales por correo'
                              : 'Solo se envían a usuarios activos'
                          }
                        >
                          <Send />
                          <span className="sr-only">Enviar credenciales a {nombre}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setUsuarioAEliminar(row)}
                          disabled={eliminandoId === row.usuario_id}
                          title="Eliminar usuario"
                        >
                          <Trash2 />
                          <span className="sr-only">Eliminar {nombre}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
          </TableBody>
        </Table>

        <DataTablePagination pagination={paginacion} etiqueta="usuarios" />
      </section>

      {/* Crear / editar */}
      <FormDrawer
        open={mostrarModal}
        onOpenChange={(open) => (open ? null : cerrarModal())}
        title={editando ? 'Editar perfil de usuario' : 'Nuevo usuario'}
        description="Completa los datos personales, de acceso y perfil profesional en una sola vista."
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        submitting={guardando}
        submitLabel={editando ? 'Actualizar usuario' : 'Crear usuario'}
        headerExtra={
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-primary" />
              {`${formulario.nombre || 'Nuevo'} ${formulario.apellido || 'usuario'}`.trim()}
            </span>
            <span className="text-xs text-muted-foreground">
              {formulario.email || 'Sin correo definido'}
            </span>
            <span className="ml-auto flex gap-2">
              <Badge variant="secondary">{editando ? 'Modo edición' : 'Modo creación'}</Badge>
              <Badge variant="secondary" className="capitalize">
                {formulario.rol || 'Sin rol'}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {formulario.estado || 'activo'}
              </Badge>
            </span>
          </div>
        }
      >
        <FormSection title="Información personal" description="Datos básicos para identificar y contactar al usuario.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="u-nombre">
              <Input
                id="u-nombre"
                value={formulario.nombre}
                onChange={(e) => setCampo('nombre', e.target.value)}
                placeholder="Ej. Andrea"
              />
            </Field>
            <Field label="Apellido" htmlFor="u-apellido">
              <Input
                id="u-apellido"
                value={formulario.apellido}
                onChange={(e) => setCampo('apellido', e.target.value)}
                placeholder="Ej. Pérez"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo electrónico" htmlFor="u-email">
              <Input
                id="u-email"
                type="email"
                value={formulario.email}
                onChange={(e) => setCampo('email', e.target.value)}
                placeholder="usuario@correo.com"
              />
            </Field>
            <Field label="Celular" htmlFor="u-celular">
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="u-celular"
                  value={formulario.celular}
                  onChange={(e) => setCampo('celular', e.target.value)}
                  placeholder="3001234567"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          <Field label="Organismo / Área universitaria" htmlFor="u-dependencia">
            <Select
              value={formulario.dependencia_id || 'sin-asignar'}
              onValueChange={(v) => setCampo('dependencia_id', v === 'sin-asignar' ? '' : v)}
            >
              <SelectTrigger id="u-dependencia">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Seleccione una dependencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin-asignar">Sin asignar</SelectItem>
                {dependencias.map((dep) => (
                  <SelectItem key={dep.dependencia_id} value={String(dep.dependencia_id)}>
                    {dep.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FormSection>

        <FormSection title="Acceso al sistema" description="Configuración de rol, estado y credenciales del usuario.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rol" htmlFor="u-rol">
              <Select value={formulario.rol} onValueChange={(v) => setCampo('rol', v)}>
                <SelectTrigger id="u-rol">
                  <SelectValue placeholder="Seleccione un rol" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((rol) => (
                    <SelectItem key={rol.value} value={rol.value}>
                      {rol.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Estado" htmlFor="u-estado">
              <Select value={formulario.estado} onValueChange={(v) => setCampo('estado', v)}>
                <SelectTrigger id="u-estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((estado) => (
                    <SelectItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Contraseña"
            htmlFor="u-password"
            help={
              editando
                ? 'Por seguridad no se muestra la contraseña actual. Escribe una nueva solo si necesitas reemplazarla.'
                : 'Este campo es obligatorio al crear el usuario.'
            }
          >
            <div className="relative">
              <Input
                id="u-password"
                type={mostrarPassword ? 'text' : 'password'}
                value={formulario.password}
                onChange={(e) => setCampo('password', e.target.value)}
                autoComplete="new-password"
                className="pr-10"
                placeholder={
                  editando ? 'Déjalo vacío para no cambiarla' : 'Define una contraseña segura'
                }
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                {mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </FormSection>

        <FormSection title="Perfil profesional" description="Información complementaria para clasificar mejor a los auditores y usuarios.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de personal" htmlFor="u-tipo-personal">
              <Select
                value={formulario.tipo_personal || 'sin-definir'}
                onValueChange={(v) => setCampo('tipo_personal', v === 'sin-definir' ? '' : v)}
              >
                <SelectTrigger id="u-tipo-personal">
                  <SelectValue placeholder="Seleccione un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin-definir">Sin definir</SelectItem>
                  {TIPOS_PERSONAL.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tipo de estudio" htmlFor="u-tipo-estudio">
              <Select
                value={formulario.tipo_estudio || 'sin-definir'}
                onValueChange={(v) => setCampo('tipo_estudio', v === 'sin-definir' ? '' : v)}
              >
                <SelectTrigger id="u-tipo-estudio">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Seleccione un nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sin-definir">Sin definir</SelectItem>
                  {TIPOS_ESTUDIO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Estudios"
            htmlFor="u-estudios"
            help="Puedes registrar programa, énfasis o trayectoria académica relevante."
          >
            <Textarea
              id="u-estudios"
              rows={4}
              value={formulario.estudios}
              onChange={(e) => setCampo('estudios', e.target.value)}
              placeholder="Ej. Contaduría Pública, Especialización en Control Interno…"
            />
          </Field>
        </FormSection>
      </FormDrawer>

      {/* Confirmar borrado */}
      <Dialog
        open={Boolean(usuarioAEliminar)}
        onOpenChange={(open) => (open ? null : setUsuarioAEliminar(null))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Vas a eliminar a{' '}
              <span className="font-medium text-foreground">
                {usuarioAEliminar?.nombre} {usuarioAEliminar?.apellido}
              </span>{' '}
              ({usuarioAEliminar?.email}). Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUsuarioAEliminar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarEliminacion}
              disabled={eliminandoId === usuarioAEliminar?.usuario_id}
            >
              {eliminandoId === usuarioAEliminar?.usuario_id ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
