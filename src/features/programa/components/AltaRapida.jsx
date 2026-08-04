'use client'

/**
 * Alta rápida de dependencias y auditores desde el cronograma.
 *
 * Al armar el programa del año aparece constantemente una dependencia que
 * todavía no está en el catálogo o un auditor recién vinculado. Sin esto había
 * que cerrar el panel —perdiendo lo escrito—, ir a Administración, crearlo y
 * empezar de nuevo. Estos diálogos piden lo mínimo, crean el registro y
 * devuelven el nombre para ponerlo en la línea del cronograma.
 *
 * Salen por encima del panel lateral sin hacer nada especial: `Dialog` usa
 * `Z_DIALOG`, que ya está por encima del drawer. Ver `components/ui/tokens.js`.
 */
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'react-toastify'

import { Button } from '@/components/ui/button'
import { Field, FieldGrid } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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

import { crearDependencia } from '@/features/dependencias/api/dependencias-api'
import { crearUsuario } from '@/features/usuarios/api/usuarios-api'
import { PROCESOS } from '@/lib/catalogos/procesos'

/** El «+» que va junto a la etiqueta de un campo. */
export function BotonMas({ onClick, title }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={title}
      className="h-6 w-6 shrink-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
    >
      <Plus className="h-3.5 w-3.5" />
      <span className="sr-only">{title}</span>
    </Button>
  )
}

/**
 * Envoltorio común de los dos diálogos.
 *
 * El `stopPropagation` del submit no es decorativo: el diálogo se declara
 * dentro del formulario del programa y, aunque el portal lo saque del DOM,
 * React sigue propagando el evento por el árbol de componentes. Sin él, dar de
 * alta una dependencia enviaba el programa entero.
 */
function DialogoAlta({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  guardando,
  onSubmit,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (guardando ? null : onOpenChange(v))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSubmit()
          }}
        >
          {children}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dependencia nueva, ya clasificada en el proceso desde el que se abrió.
 *
 * El proceso se puede cambiar por si se está creando desde la sección
 * equivocada, pero viene puesto: es lo que va a ser en el 95 % de los casos.
 */
export function NuevaDependenciaDialog({ open, onOpenChange, procesoClave, onCreada }) {
  const [nombre, setNombre] = useState('')
  const [gestion, setGestion] = useState('otras')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre('')
    setGestion(procesoClave || 'otras')
  }, [open, procesoClave])

  const guardar = async () => {
    const limpio = nombre.trim()
    if (!limpio) {
      toast.error('Escribe el nombre de la dependencia.')
      return
    }

    try {
      setGuardando(true)
      const creada = await crearDependencia({ nombre: limpio, gestion })
      toast.success(`Dependencia «${creada.nombre}» creada.`)
      onCreada(creada)
      onOpenChange(false)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <DialogoAlta
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva dependencia"
      description="Se añade al catálogo y queda seleccionada en esta línea del cronograma."
      submitLabel="Crear dependencia"
      guardando={guardando}
      onSubmit={guardar}
    >
      <FieldGrid columns={1}>
        <Field label="Nombre" htmlFor="alta-dep-nombre" required>
          <Input
            id="alta-dep-nombre"
            value={nombre}
            // En mayúsculas, como en Administrar Dependencias: el catálogo se
            // mantiene consistente y los nombres se casan por texto.
            onChange={(e) => setNombre(e.target.value.toUpperCase())}
            placeholder="NOMBRE DE LA DEPENDENCIA"
            autoFocus
          />
        </Field>

        <Field
          label="Proceso"
          htmlFor="alta-dep-proceso"
          required
          help="Determina en qué sección del cronograma se ofrece."
        >
          <Select value={gestion} onValueChange={setGestion}>
            <SelectTrigger id="alta-dep-proceso">
              <SelectValue placeholder="Selecciona un proceso" />
            </SelectTrigger>
            <SelectContent>
              {PROCESOS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGrid>
    </DialogoAlta>
  )
}

/**
 * Auditor nuevo, con lo imprescindible para que pueda entrar.
 *
 * Se crea siempre con rol auditor y activo —es para lo que se abre desde
 * aquí—; el resto de la ficha (dependencia, estudios, celular) se completa
 * luego en Administración, que es donde se ve entera.
 *
 * No manda el correo de credenciales: eso sale del sistema hacia una persona y
 * no debe pasar de refilón mientras se arma un cronograma. Se envía desde
 * Administración cuando se decida.
 */
export function NuevoAuditorDialog({ open, onOpenChange, onCreado }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', password: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ nombre: '', apellido: '', email: '', password: '' })
  }, [open])

  const set = (campo) => (e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))

  const guardar = async () => {
    const nombre = form.nombre.trim()
    const apellido = form.apellido.trim()
    const email = form.email.trim()

    const error =
      (!nombre && 'El nombre es obligatorio.') ||
      (!apellido && 'El apellido es obligatorio.') ||
      (!email && 'El correo es obligatorio.') ||
      (!form.password.trim() && 'La contraseña es obligatoria para crear el usuario.')

    if (error) {
      toast.error(error)
      return
    }

    try {
      setGuardando(true)
      const creado = await crearUsuario({
        nombre,
        apellido,
        email,
        password: form.password,
        rol: 'auditor',
        estado: 'activo',
      })

      toast.success('Auditor creado.')
      onCreado(creado)
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <DialogoAlta
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo auditor"
      description="Se crea con rol auditor y activo, y queda añadido a esta línea del cronograma."
      submitLabel="Crear auditor"
      guardando={guardando}
      onSubmit={guardar}
    >
      <FieldGrid columns={2}>
        <Field label="Nombre" htmlFor="alta-aud-nombre" required>
          <Input id="alta-aud-nombre" value={form.nombre} onChange={set('nombre')} autoFocus />
        </Field>

        <Field label="Apellido" htmlFor="alta-aud-apellido" required>
          <Input id="alta-aud-apellido" value={form.apellido} onChange={set('apellido')} />
        </Field>

        <Field label="Correo" htmlFor="alta-aud-email" required wide>
          <Input
            id="alta-aud-email"
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="nombre@unicauca.edu.co"
            autoComplete="off"
          />
        </Field>

        <Field
          label="Contraseña"
          htmlFor="alta-aud-password"
          required
          help="Con ella entra por primera vez. Puedes enviársela por correo desde Administración › Usuarios."
          wide
        >
          <Input
            id="alta-aud-password"
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
          />
        </Field>
      </FieldGrid>
    </DialogoAlta>
  )
}
