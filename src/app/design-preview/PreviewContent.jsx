'use client'

// TEMPORAL — solo para revisar el sistema de diseño. Se elimina tras validar.
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Combobox, ComboboxMultiple } from '@/components/ui/combobox'
import { Field, FieldGrid } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { DatePicker } from '@/components/ui/date-picker'
import { Input, Textarea } from '@/components/ui/input'
import { HeaderStat, PageHeader } from '@/components/ui/page-header'
import { InfoCard } from '@/components/ui/info-card'
import { StickyBar } from '@/components/ui/sticky-bar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PAGE_SHELL, STATUS_BADGE_TONES, TABLE_CONTAINER, TABLE_TOOLBAR } from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

const KPIS = [
  { tono: 'blue', label: 'Total', value: 78 },
  { tono: 'purple', label: 'Estratégica', value: 6 },
  { tono: 'green', label: 'Académica', value: 31 },
  { tono: 'cyan', label: 'Investigación', value: 9 },
  { tono: 'orange', label: 'Administrativa', value: 18 },
  { tono: 'pink', label: 'Cultura', value: 7 },
  { tono: 'indigo', label: 'Control', value: 4 },
  { tono: 'gray', label: 'Otras', value: 3 },
]

/** Las etiquetas largas van a propósito: es lo que se sale si la rejilla aprieta. */
const METRICAS = [
  { tono: 'blue', label: 'Total auditorías', value: 16 },
  { tono: 'purple', label: 'Planes', value: 12, total: 16 },
  { tono: 'green', label: 'Asistencias', value: 14, total: 16 },
  { tono: 'orange', label: 'Evaluaciones', value: 11, total: 16 },
  { tono: 'cyan', label: 'Actas', value: 9, total: 16 },
  { tono: 'pink', label: 'Actas compromiso', value: 6, total: 16 },
  { tono: 'teal', label: 'Informes completos', value: 8, total: 16 },
  { tono: 'indigo', label: 'Validados', value: 7, total: 16 },
]

const FILAS = [
  { id: 12, nombre: 'ÁREA DE EGRESADOS', gestion: 'Académica', badge: 'success' },
  { id: 27, nombre: 'CENTRO DE POSGRADOS', gestion: 'Académica', badge: 'success' },
  { id: 41, nombre: 'DIVISIÓN DE TALENTO HUMANO', gestion: 'Administrativa', badge: 'warning' },
  { id: 55, nombre: 'UNIDAD DE PERMANENCIA Y GRADUACIÓN', gestion: 'Control', badge: 'info' },
]

const OPCIONES_DEPENDENCIA = FILAS.map((f) => ({
  value: f.nombre,
  description: `Gestión ${f.gestion}`,
}))

const OPCIONES_AUDITOR = [
  { value: 'Ana Pérez', description: 'ana.perez@unicauca.edu.co', datos: { email: 'ana.perez@unicauca.edu.co' } },
  { value: 'Luis Gómez', description: 'luis.gomez@unicauca.edu.co', datos: { email: 'luis.gomez@unicauca.edu.co' } },
  { value: 'Marta Ruiz', description: 'marta.ruiz@unicauca.edu.co', datos: { email: 'marta.ruiz@unicauca.edu.co' } },
]

const OPCIONES_NUMERAL = [
  { value: '4.1', description: 'Comprensión de la organización y su contexto' },
  { value: '4.2', description: 'Necesidades y expectativas de las partes interesadas' },
  { value: '5.1', description: 'Liderazgo y compromiso' },
  { value: '8.1', description: 'Planificación y control operacional' },
  { value: '9.2', description: 'Auditoría interna' },
]

export default function PreviewContent() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dependencia, setDependencia] = useState('')
  const [auditor, setAuditor] = useState('')
  const [correo, setCorreo] = useState('')
  const [requisitos, setRequisitos] = useState('4.1, 9.2')
  const [fecha, setFecha] = useState('2026-07-27')

  // Fuera de `AppShell`, así que el padding lo pone esta página.
  return (
    <div className={cn(PAGE_SHELL, 'min-h-screen bg-app p-5 sm:p-6 lg:p-8')}>
      <PageHeader
        title="Administrar Dependencias"
        subtitle="Gestión de dependencias y áreas organizacionales"
        actions={
          <Button className="bg-white/15 text-white shadow-none backdrop-blur-sm hover:bg-white/25">
            <Plus />
            Nueva dependencia
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        {KPIS.map((k) => (
          <InfoCard key={k.label} tone={k.tono} label={k.label} value={k.value} />
        ))}
      </section>

      {/* La misma tarjeta con total y barra de avance. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        {METRICAS.map((m) => (
          <InfoCard
            key={m.label}
            label={m.label}
            tone={m.tono}
            value={m.value}
            total={m.total}
            percent={m.total ? Math.round((m.value / m.total) * 100) : undefined}
            hint={m.total ? undefined : 'En el periodo seleccionado'}
          />
        ))}
      </section>

      <section className={TABLE_CONTAINER}>
        <div className={TABLE_TOOLBAR}>
          <h2 className="text-sm font-semibold">Listado de dependencias</h2>
          <Input placeholder="Buscar por nombre…" className="w-full sm:w-72" />
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-56">Gestión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FILAS.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="tabular-nums text-muted-foreground">{f.id}</TableCell>
                <TableCell className="font-medium">{f.nombre}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(STATUS_BADGE_TONES[f.badge])}>
                    {f.gestion}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <PageHeader
        title="Alertas de Auditoría Interna"
        subtitle="Activa o desactiva notificaciones por proceso y ejecuta un barrido manual."
        stats={
          <>
            <HeaderStat label="Procesos activos" value={6} />
            <HeaderStat label="Alertas habilitadas" value={14} />
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button>Primario</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructivo</Button>
        <Button variant="success">Éxito</Button>
      </div>

      {/* Primitivos de formulario: FormSection + Field + StickyBar + FormDrawer */}
      <FormSection
        title="Campos obligatorios"
        description="Panel tintado con borde continuo, para lo que hay que diligenciar."
        actions={
          <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            2/3 completados
          </span>
        }
      >
        <FieldGrid>
          <Field label="Fecha de la auditoría" htmlFor="preview-fecha" required>
            <DatePicker id="preview-fecha" value={fecha} onChange={setFecha} />
          </Field>

          <Field label="Asistencia" htmlFor="preview-asistencia" required>
            <Input id="preview-asistencia" defaultValue="Digital" />
          </Field>

          <Field
            label="Objetivo"
            htmlFor="preview-objetivo"
            required
            error="El objetivo es obligatorio."
          >
            <Input id="preview-objetivo" placeholder="Para qué se hizo esta auditoría…" />
          </Field>

          <Field
            label="Criterios"
            htmlFor="preview-criterios"
            required
            wide
            help="Ocupa toda la fila con `wide`."
          >
            <Textarea id="preview-criterios" placeholder="Normas y procedimientos…" />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        tone="neutral"
        title="Combobox"
        description="Sugerencias de la base de datos sin cerrar la puerta al texto libre: se puede escribir un valor que no esté en la lista."
      >
        <FieldGrid>
          <Field
            label="Dependencia"
            htmlFor="preview-dep"
            help={`Elegida: ${dependencia || '—'}`}
          >
            <Combobox
              id="preview-dep"
              value={dependencia}
              onChange={setDependencia}
              options={OPCIONES_DEPENDENCIA}
              placeholder="Busca o escribe una dependencia…"
            />
          </Field>

          <Field label="Auditor" htmlFor="preview-aud" help={`Correo: ${correo || '—'}`}>
            <Combobox
              id="preview-aud"
              value={auditor}
              // Elegir de la lista rellena de paso el campo vecino.
              onChange={(valor, opcion) => {
                setAuditor(valor)
                setCorreo(opcion?.datos?.email ?? '')
              }}
              options={OPCIONES_AUDITOR}
              placeholder="Busca o escribe un auditor…"
            />
          </Field>

          <Field
            label="Requisitos ISO"
            htmlFor="preview-req"
            wide
            help={`Se guarda como una sola cadena: "${requisitos || '—'}"`}
          >
            <ComboboxMultiple
              id="preview-req"
              value={requisitos}
              onChange={setRequisitos}
              options={OPCIONES_NUMERAL}
              placeholder="Busca un numeral…"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection
        tone="optional"
        title="Campos opcionales"
        description="Borde discontinuo: se puede dejar en blanco."
      >
        <FieldGrid>
          <Field
            label="Auditores acompañantes"
            htmlFor="preview-acompanantes"
            help="Separa cada nombre con una coma."
          >
            <Input id="preview-acompanantes" placeholder="Ana Pérez, Luis Gómez" />
          </Field>
        </FieldGrid>
      </FormSection>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setDrawerOpen(true)}>Abrir drawer de ejemplo</Button>
      </div>

      <StickyBar info="Falta 1 campo obligatorio">
        <Button variant="outline">Cancelar</Button>
        <Button>Guardar informe</Button>
      </StickyBar>

      <FormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nuevo registro"
        description="Panel lateral con cabecera fija, cuerpo desplazable y pie de acciones."
        submitLabel="Crear registro"
        onSubmit={(e) => {
          e.preventDefault()
          setDrawerOpen(false)
        }}
      >
        <FormSection title="Campos obligatorios">
          <FieldGrid>
            <Field label="Nombre" htmlFor="drawer-nombre" required>
              <Input id="drawer-nombre" placeholder="Nombre completo" />
            </Field>
            <Field label="Documento" htmlFor="drawer-doc" required>
              <Input id="drawer-doc" placeholder="1061…" />
            </Field>
            <Field label="Correo" htmlFor="drawer-mail" error="El correo no es válido.">
              <Input id="drawer-mail" defaultValue="correo-mal" />
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection tone="optional" title="Campos opcionales">
          <FieldGrid>
            <Field label="Observaciones" htmlFor="drawer-obs" wide>
              <Textarea id="drawer-obs" placeholder="Cualquier detalle adicional…" />
            </Field>
          </FieldGrid>
        </FormSection>
      </FormDrawer>
    </div>
  )
}
