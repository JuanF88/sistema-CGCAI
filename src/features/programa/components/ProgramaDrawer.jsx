'use client'

/**
 * Alta y edición del Programa de Auditoría Interna.
 *
 * El formato tiene tres partes bien distintas —cabecera, cronograma y
 * distribución—, así que el panel se organiza en pestañas en vez de un scroll
 * de varias pantallas.
 */
import { useEffect, useState } from 'react'
import { CalendarRange, FileText, Users } from 'lucide-react'
import { toast } from 'react-toastify'

import { Combobox, ComboboxMultiple } from '@/components/ui/combobox'
import { Field, FieldGrid } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { Input, Textarea } from '@/components/ui/input'
import { ViewToggle } from '@/components/ui/view-toggle'

import {
  CRONOGRAMA_VACIO,
  DISTRIBUCION_VACIA,
  MESES,
  PROGRAMA_INICIAL,
} from '@/features/programa/lib/formato'
import { useCatalogosPrograma } from '@/features/programa/hooks/useCatalogosPrograma'
import { FilasEditables } from './FilasEditables'
import { ListasMetodologia } from './ListasMetodologia'

const PESTANAS = [
  { key: 'cabecera', label: 'Cabecera', icon: FileText },
  { key: 'cronograma', label: 'Cronograma', icon: CalendarRange },
  { key: 'distribucion', label: 'Distribución', icon: Users },
]

const OPCIONES_MES = MESES.map((value) => ({ value }))

const ESTADOS = [
  {
    value: 'borrador',
    label: 'Borrador',
    description: 'En elaboración; se puede seguir editando',
    help: 'Todavía no es el programa oficial del año.',
  },
  {
    value: 'aprobado',
    label: 'Aprobado',
    description: 'Programa oficial del año',
    help: 'Rellena también quién lo aprueba y la fecha, en el pie del formato.',
  },
  {
    value: 'archivado',
    label: 'Archivado',
    description: 'De años anteriores o reemplazado',
    help: 'Se conserva para consulta, pero ya no está vigente.',
  },
]

/**
 * Cambio de estado, con la fecha de aprobación que arrastra.
 *
 * Al aprobar se pone la fecha de hoy si no había ninguna: el formato la exige
 * en el pie y dejarla en blanco es el olvido más fácil de cometer. Si ya
 * había una escrita se respeta.
 */
function cambioDeEstado(form, estado) {
  if (estado !== 'aprobado' || String(form.fecha_aprobacion ?? '').trim()) {
    return { estado }
  }

  return { estado, fecha_aprobacion: new Date().toISOString().slice(0, 10) }
}

/**
 * Copia limpia del programa inicial.
 *
 * Función y no constante porque las listas de riesgos, controles y
 * oportunidades son arrays: compartir la referencia entre dos aperturas del
 * drawer haría que lo escrito en una apareciera en la siguiente.
 */
const formInicial = () => ({
  ...PROGRAMA_INICIAL,
  riesgos: [...PROGRAMA_INICIAL.riesgos],
  controles: [...PROGRAMA_INICIAL.controles],
  oportunidades: [...PROGRAMA_INICIAL.oportunidades],
})

/** Campo de texto largo del formato. */
const Bloque = ({ label, valor, onChange, filas = 4, help }) => (
  <Field label={label} help={help} wide>
    <Textarea
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={filas}
      spellCheck="true"
      className="bg-background"
    />
  </Field>
)

/**
 * Lo que se exporta de una asignación sin haberlo tecleado.
 *
 * Se muestra en lugar de los quince campos que había antes: son datos que ya
 * están en el sistema, y volver a escribirlos solo abre la puerta a que
 * discrepen. Lo que no tiene origen en la base —coordinador, decanatura,
 * decano— se dice claramente en vez de dejar un hueco silencioso.
 */
const DERIVADOS = [
  { key: 'auditor_correo', label: 'Correo del auditor' },
  { key: 'responsable_titulo', label: 'Nivel académico' },
  { key: 'auditor_estudios', label: 'Estudios' },
  { key: 'gestion', label: 'Gestión' },
  { key: 'organismo', label: 'Organismo' },
  { key: 'gestor_nombre', label: 'Gestor de calidad' },
  { key: 'gestor_correo', label: 'Correo del gestor' },
]

function ResumenAsignacion({ fila }) {
  const conDato = DERIVADOS.filter(({ key }) => String(fila[key] ?? '').trim())

  if (!conDato.length) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-3 text-center text-xs text-muted-foreground">
        Elige el auditor y la dependencia para ver lo que se va a exportar.
      </p>
    )
  }

  return (
    <dl className="grid gap-x-4 gap-y-2 rounded-xl border border-border bg-background/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {conDato.map(({ key, label }) => (
        <div key={key} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </dt>
          <dd className="truncate text-sm" title={fila[key]}>
            {fila[key]}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ProgramaDrawer({ open, onOpenChange, programa, onGuardar, guardando }) {
  const [tab, setTab] = useState('cabecera')
  const [form, setForm] = useState(formInicial)
  const [cronograma, setCronograma] = useState([])
  const [distribucion, setDistribucion] = useState([])

  const editando = Boolean(programa?.id)

  // Los catálogos solo se piden con el panel abierto, y una sola vez por apertura.
  const {
    opciones,
    cargando: cargandoCatalogos,
    derivarDeDependencia,
  } = useCatalogosPrograma(open)

  // Al abrir: carga el programa a editar, o parte de los textos del formato.
  useEffect(() => {
    if (!open) return

    if (programa) {
      const { cronograma: cr, distribucion: di, ...cabecera } = programa
      setForm({
        ...formInicial(),
        ...cabecera,
        fecha_aprobacion: cabecera.fecha_aprobacion ?? '',
        // Un programa guardado sin listas llega con `null`, no con `[]`.
        riesgos: cabecera.riesgos ?? [],
        controles: cabecera.controles ?? [],
        oportunidades: cabecera.oportunidades ?? [],
      })
      setCronograma(cr ?? [])
      setDistribucion(di ?? [])
    } else {
      setForm(formInicial())
      setCronograma([])
      setDistribucion([])
    }
    setTab('cabecera')
  }, [open, programa])

  /** `set('campo', valor)` o `set({ campo: valor, otro: valor })`. */
  const set = (campoOParche, valor) =>
    setForm((prev) => ({
      ...prev,
      ...(typeof campoOParche === 'string' ? { [campoOParche]: valor } : campoOParche),
    }))

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!String(form.nombre || '').trim()) {
      toast.error('El nombre del programa es obligatorio.')
      setTab('cabecera')
      return
    }

    // El campo admite texto libre, pero la columna tiene un CHECK: se avisa
    // aquí en vez de dejar que reviente en la base.
    if (!ESTADOS.some((e) => e.value === form.estado)) {
      toast.error('El estado debe ser borrador, aprobado o archivado.')
      setTab('cabecera')
      return
    }

    const sinProceso = cronograma.some((f) => !String(f.proceso || '').trim())
    if (sinProceso) {
      toast.error('Cada fila del cronograma necesita un proceso a auditar.')
      setTab('cronograma')
      return
    }

    if (distribucion.some((f) => !String(f.proceso || '').trim())) {
      toast.error('Cada fila de la distribución necesita un proceso.')
      setTab('distribucion')
      return
    }

    onGuardar({ ...form, cronograma, distribucion })
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editando ? `Programa ${form.anio} — ${form.nombre}` : 'Nuevo programa de auditoría'}
      description="Formato PE-GS-2.2.1-FOR-7. Los textos institucionales vienen precargados y son editables."
      onSubmit={handleSubmit}
      submitting={guardando}
      submitLabel={editando ? 'Guardar cambios' : 'Crear programa'}
      headerExtra={
        <ViewToggle options={PESTANAS} value={tab} onChange={setTab} className="mt-3 self-start" />
      }
      footerInfo={
        <span>
          {cronograma.length} fila{cronograma.length === 1 ? '' : 's'} de cronograma ·{' '}
          {distribucion.length} de distribución
        </span>
      }
    >
      {/* ── Cabecera ── */}
      {tab === 'cabecera' && (
        <>
          <FormSection title="Identificación">
            <FieldGrid>
              <Field label="Año" htmlFor="pa-anio" required>
                <Input
                  id="pa-anio"
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.anio}
                  onChange={(e) => set('anio', e.target.value)}
                />
              </Field>

              <Field label="Nombre del programa" htmlFor="pa-nombre" required>
                <Input
                  id="pa-nombre"
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  placeholder="Programa AI Estratégico"
                />
              </Field>

              <Field label="Mes de auditoría" htmlFor="pa-mes">
                <Combobox
                  id="pa-mes"
                  value={form.mes_auditoria ?? ''}
                  options={OPCIONES_MES}
                  onChange={(valor) => set('mes_auditoria', valor)}
                  placeholder="Selecciona el mes"
                />
              </Field>

              <Field
                label="Estado"
                htmlFor="pa-estado"
                help={ESTADOS.find((e) => e.value === form.estado)?.help}
              >
                <Combobox
                  id="pa-estado"
                  value={form.estado ?? 'borrador'}
                  options={ESTADOS}
                  onChange={(valor) => set(cambioDeEstado(form, valor))}
                  // El valor guardado es en minúsculas (lo exige el CHECK de
                  // la tabla); solo se muestra capitalizado.
                  className="capitalize"
                  vacio="Elige uno de los tres estados."
                />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormSection title="Objetivo y alcance">
            <FieldGrid columns={1}>
              <Bloque
                label="Objetivo del programa"
                valor={form.objetivo}
                onChange={(v) => set('objetivo', v)}
                filas={7}
              />
              <Bloque
                label="Alcance del programa"
                valor={form.alcance}
                onChange={(v) => set('alcance', v)}
                filas={3}
              />
            </FieldGrid>
          </FormSection>

          <FormSection title="Recursos">
            <FieldGrid>
              <Bloque
                label="Talento humano"
                valor={form.recurso_humano}
                onChange={(v) => set('recurso_humano', v)}
                filas={4}
              />
              <Bloque
                label="Financiero"
                valor={form.recurso_financiero}
                onChange={(v) => set('recurso_financiero', v)}
                filas={4}
              />
              <Bloque
                label="Tecnológico"
                valor={form.recurso_tecnologico}
                onChange={(v) => set('recurso_tecnologico', v)}
                filas={4}
              />
            </FieldGrid>
          </FormSection>

          <FormSection
            title="Criterios"
            description="En el Excel salen repartidos en dos columnas; aquí se escriben en una sola lista y la exportación los reparte."
          >
            <FieldGrid columns={1}>
              <Bloque
                label="Criterios del programa"
                valor={form.criterios}
                onChange={(v) => set('criterios', v)}
                filas={12}
              />
            </FieldGrid>
          </FormSection>

          <FormSection
            title="Metodología"
            description="Cómo se ejecuta el programa y qué riesgos, controles y oportunidades se identifican."
          >
            <FieldGrid columns={1}>
              <Bloque
                label="Metodología"
                valor={form.metodologia}
                onChange={(v) => set('metodologia', v)}
                filas={6}
              />
            </FieldGrid>

            <ListasMetodologia listas={form} onChange={set} />
          </FormSection>

          <FormSection tone="optional" title="Pie del formato">
            <FieldGrid columns={1}>
              <Bloque
                label="Nomenclatura"
                valor={form.nomenclatura}
                onChange={(v) => set('nomenclatura', v)}
                filas={2}
              />
              <Bloque
                label="Observaciones"
                valor={form.observaciones}
                onChange={(v) => set('observaciones', v)}
                filas={3}
              />
            </FieldGrid>

            <FieldGrid>
              <Field label="Elaborado por" htmlFor="pa-elab">
                <Input
                  id="pa-elab"
                  value={form.elaborado_por ?? ''}
                  onChange={(e) => set('elaborado_por', e.target.value)}
                />
              </Field>
              <Field label="Cargo" htmlFor="pa-elab-cargo">
                <Input
                  id="pa-elab-cargo"
                  value={form.elaborado_cargo ?? ''}
                  onChange={(e) => set('elaborado_cargo', e.target.value)}
                />
              </Field>
              <Field label="Fecha de aprobación" htmlFor="pa-fecha">
                <Input
                  id="pa-fecha"
                  type="date"
                  value={form.fecha_aprobacion ?? ''}
                  onChange={(e) => set('fecha_aprobacion', e.target.value)}
                />
              </Field>

              <Field label="Revisado por" htmlFor="pa-rev">
                <Input
                  id="pa-rev"
                  value={form.revisado_por ?? ''}
                  onChange={(e) => set('revisado_por', e.target.value)}
                />
              </Field>
              <Field label="Cargo" htmlFor="pa-rev-cargo">
                <Input
                  id="pa-rev-cargo"
                  value={form.revisado_cargo ?? ''}
                  onChange={(e) => set('revisado_cargo', e.target.value)}
                />
              </Field>
              <span />

              <Field label="Aprobado por" htmlFor="pa-apr">
                <Input
                  id="pa-apr"
                  value={form.aprobado_por ?? ''}
                  onChange={(e) => set('aprobado_por', e.target.value)}
                />
              </Field>
              <Field label="Cargo" htmlFor="pa-apr-cargo">
                <Input
                  id="pa-apr-cargo"
                  value={form.aprobado_cargo ?? ''}
                  onChange={(e) => set('aprobado_cargo', e.target.value)}
                />
              </Field>
            </FieldGrid>
          </FormSection>
        </>
      )}

      {/* ── Cronograma ── */}
      {tab === 'cronograma' && (
        <FormSection
          title="Cronograma"
          description="Una fila por proceso auditado, con sus requisitos de cada norma."
          actions={
            cargandoCatalogos && (
              <span className="text-xs text-muted-foreground">Cargando catálogos…</span>
            )
          }
        >
          <FilasEditables
            filas={cronograma}
            onChange={setCronograma}
            filaVacia={CRONOGRAMA_VACIO}
            etiqueta="Fila"
            vacio="Todavía no hay procesos en el cronograma."
          >
            {(fila, i, set) => (
              <FieldGrid columns={2}>
                <Field
                  label="Proceso a auditar"
                  htmlFor={`cr-proceso-${i}`}
                  required
                  help="Del catálogo de dependencias"
                >
                  <Combobox
                    id={`cr-proceso-${i}`}
                    value={fila.proceso ?? ''}
                    options={opciones.dependencias}
                    onChange={(valor) => set('proceso', valor)}
                    placeholder="Gestión Académica"
                  />
                </Field>

                <Field label="Auditado / programa" htmlFor={`cr-auditado-${i}`}>
                  <Combobox
                    id={`cr-auditado-${i}`}
                    value={fila.auditado ?? ''}
                    options={opciones.dependencias}
                    onChange={(valor) => set('auditado', valor)}
                    placeholder="Rectoría"
                  />
                </Field>

                <Field
                  label="Auditor(es)"
                  htmlFor={`cr-auditores-${i}`}
                  help="Añade los que hagan falta"
                >
                  <ComboboxMultiple
                    id={`cr-auditores-${i}`}
                    value={fila.auditores ?? ''}
                    options={opciones.auditores}
                    onChange={(valor) => set('auditores', valor)}
                    placeholder="Busca un auditor…"
                  />
                </Field>

                <Field label="Requisitos ISO 9001:2015" htmlFor={`cr-9001-${i}`}>
                  <ComboboxMultiple
                    id={`cr-9001-${i}`}
                    value={fila.requisitos_9001 ?? ''}
                    options={opciones.requisitos9001}
                    onChange={(valor) => set('requisitos_9001', valor)}
                    placeholder="Busca un numeral…"
                  />
                </Field>

                <Field label="Requisitos ISO 14001:2015" htmlFor={`cr-14001-${i}`}>
                  <ComboboxMultiple
                    id={`cr-14001-${i}`}
                    value={fila.requisitos_14001 ?? ''}
                    options={opciones.requisitos14001}
                    onChange={(valor) => set('requisitos_14001', valor)}
                    placeholder="Busca un numeral…"
                  />
                </Field>
              </FieldGrid>
            )}
          </FilasEditables>
        </FormSection>
      )}

      {/* ── Distribución ── */}
      {tab === 'distribucion' && (
        <FormSection
          title="Distribución"
          description="Elige el auditor y la dependencia que va a auditar. El resto se trae del sistema."
          actions={
            cargandoCatalogos && (
              <span className="text-xs text-muted-foreground">Cargando catálogos…</span>
            )
          }
        >
          <FilasEditables
            filas={distribucion}
            onChange={setDistribucion}
            filaVacia={DISTRIBUCION_VACIA}
            etiqueta="Asignación"
            vacio="Todavía no hay asignaciones."
          >
            {(fila, i, set) => (
              <>
                <FieldGrid columns={2}>
                  <Field
                    label="Auditor"
                    htmlFor={`di-aud-${i}`}
                    help="Trae su correo, sus estudios y su nivel académico"
                  >
                    <Combobox
                      id={`di-aud-${i}`}
                      value={fila.auditor_nombre ?? ''}
                      options={opciones.auditores}
                      onChange={(valor, persona) =>
                        set(
                          persona
                            ? {
                                auditor_nombre: valor,
                                auditor_correo: persona.datos.email ?? '',
                                auditor_estudios: persona.datos.estudios ?? '',
                                responsable_nombre: valor,
                                responsable_titulo: persona.datos.tipo_estudio ?? '',
                              }
                            : { auditor_nombre: valor, responsable_nombre: valor }
                        )
                      }
                      placeholder="Busca un auditor…"
                    />
                  </Field>

                  <Field
                    label="Dependencia a auditar"
                    htmlFor={`di-proceso-${i}`}
                    required
                    help="Trae su gestión y su gestor de calidad"
                  >
                    <Combobox
                      id={`di-proceso-${i}`}
                      value={fila.proceso ?? ''}
                      options={opciones.dependencias}
                      onChange={(valor) => set(derivarDeDependencia(valor))}
                      placeholder="Busca una dependencia…"
                    />
                  </Field>
                </FieldGrid>

                <ResumenAsignacion fila={fila} />
              </>
            )}
          </FilasEditables>
        </FormSection>
      )}
    </FormDrawer>
  )
}
