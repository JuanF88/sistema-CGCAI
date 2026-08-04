'use client'

/**
 * Alta y edición del Programa de Auditoría Interna.
 *
 * El formato tiene tres partes bien distintas —cabecera, cronograma y
 * distribución—, así que el panel se organiza en pestañas en vez de un scroll
 * de varias pantallas.
 */
import { useEffect, useRef, useState } from 'react'
import { CalendarRange, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'

import { Button } from '@/components/ui/button'
import { Combobox, ComboboxMultiple } from '@/components/ui/combobox'
import { DatePicker } from '@/components/ui/date-picker'
import { Field, FieldGrid } from '@/components/ui/field'
import { FormDrawer } from '@/components/ui/form-drawer'
import { FormSection } from '@/components/ui/form-section'
import { Input, Textarea } from '@/components/ui/input'
import { ViewToggle } from '@/components/ui/view-toggle'

import {
  DEPENDENCIA_CRONOGRAMA_VACIA,
  MESES,
  PROGRAMA_INICIAL,
  SEMANAS,
  cronogramaInicial,
  seccionCronograma,
  semanasDe,
  totalDependenciasCronograma,
} from '@/features/programa/lib/formato'
import { distribucionDesdeCronograma } from '@/features/programa/lib/distribucion'
import { useCatalogosPrograma } from '@/features/programa/hooks/useCatalogosPrograma'
import { PROCESOS_CRONOGRAMA } from '@/lib/catalogos/procesos'
import { subirAlInicio } from '@/lib/dom/desplazar'
import { BotonMas, NuevaDependenciaDialog, NuevoAuditorDialog } from './AltaRapida'
import { ListasMetodologia } from './ListasMetodologia'

/**
 * Dos pestañas, no tres.
 *
 * La de «Distribución» desapareció: se rellenaba a mano repitiendo lo que ya
 * está en el cronograma —proceso, dependencia auditada y auditores— y el resto
 * sale del catálogo. Ahora se deduce al guardar (`distribucionDesdeCronograma`).
 */
const PESTANAS = [
  { key: 'cabecera', label: 'Cabecera', icon: FileText },
  { key: 'cronograma', label: 'Cronograma', icon: CalendarRange },
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

/**
 * Un programa guardado, con las seis secciones garantizadas.
 *
 * Se respeta lo que hay —incluidas secciones de procesos que ya no estén en el
 * mapa, para no hacer desaparecer datos— y se completan las que falten. Un
 * programa creado antes de agrupar por proceso puede traer varias secciones del
 * mismo proceso; se dejan como están y se ven en el formulario.
 */
function conLasSeisSecciones(guardado) {
  const secciones = [...(guardado ?? [])].map((s) => ({ ...s, dependencias: s.dependencias ?? [] }))
  const presentes = new Set(secciones.map((s) => s.proceso_clave).filter(Boolean))

  const faltantes = PROCESOS_CRONOGRAMA.filter((p) => !presentes.has(p.value)).map(
    seccionCronograma
  )

  // Las que falten van al final; reordenar lo guardado movería de sitio filas
  // que el usuario ya había dispuesto en un orden concreto.
  return [...secciones, ...faltantes]
}

/**
 * La cuadrícula de semanas del cronograma.
 *
 * Cuatro botones y no un desplegable: son cuatro opciones fijas, se marcan
 * varias a la vez y así se parece a la cuadrícula que se ve en el Excel.
 */
function SelectorSemanas({ id, value, onChange }) {
  const marcadas = semanasDe(value)

  const alternar = (semana) => {
    const siguiente = new Set(marcadas)
    if (siguiente.has(semana)) siguiente.delete(semana)
    else siguiente.add(semana)

    // Se reconstruye desde `SEMANAS` para que siempre queden en orden.
    onChange(SEMANAS.filter((s) => siguiente.has(s)).join(','))
  }

  return (
    <div id={id} className="flex flex-wrap gap-2">
      {SEMANAS.map((semana) => {
        const activa = marcadas.has(semana)

        return (
          <Button
            key={semana}
            type="button"
            variant={activa ? 'default' : 'outline'}
            size="sm"
            aria-pressed={activa}
            onClick={() => alternar(semana)}
            className="min-w-[6.5rem]"
          >
            Semana {semana}
          </Button>
        )
      })}
    </div>
  )
}

/**
 * Una sección del cronograma: un proceso con sus dependencias auditadas.
 *
 * Los requisitos ISO y las semanas se piden una sola vez porque en el formato
 * van combinados en todo el bloque; debajo, una línea por dependencia con sus
 * auditores.
 */
function SeccionCronograma({
  seccion,
  indice,
  mes,
  opciones,
  dependenciasDeProceso,
  marcarErrores,
  onChange,
  onCatalogoCambiado,
}) {
  const dependencias = seccion.dependencias ?? []
  const disponibles = dependenciasDeProceso(seccion.proceso_clave)

  /** Qué alta rápida está abierta y sobre qué línea: `{ tipo, linea }`. */
  const [alta, setAlta] = useState(null)

  const cambiarDependencia = (i, parche) =>
    onChange({ dependencias: dependencias.map((d, j) => (j === i ? { ...d, ...parche } : d)) })

  const anadir = () =>
    onChange({ dependencias: [...dependencias, { ...DEPENDENCIA_CRONOGRAMA_VACIA }] })

  const eliminar = (i) => onChange({ dependencias: dependencias.filter((_, j) => j !== i) })

  return (
    <FormSection
      tone={dependencias.length ? 'required' : 'optional'}
      title={seccion.proceso}
      description="Requisitos y semanas del proceso; abajo, las dependencias que se auditan."
      actions={
        <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {dependencias.length} dependencia{dependencias.length === 1 ? '' : 's'}
        </span>
      }
    >
      <FieldGrid columns={2}>
        <Field label="Requisitos ISO 9001:2015" htmlFor={`cr-9001-${indice}`}>
          <ComboboxMultiple
            id={`cr-9001-${indice}`}
            value={seccion.requisitos_9001 ?? ''}
            options={opciones.requisitos9001}
            onChange={(valor) => onChange({ requisitos_9001: valor })}
            placeholder="Busca un numeral…"
          />
        </Field>

        <Field label="Requisitos ISO 14001:2015" htmlFor={`cr-14001-${indice}`}>
          <ComboboxMultiple
            id={`cr-14001-${indice}`}
            value={seccion.requisitos_14001 ?? ''}
            options={opciones.requisitos14001}
            onChange={(valor) => onChange({ requisitos_14001: valor })}
            placeholder="Busca un numeral…"
          />
        </Field>

        <Field
          label={`Semanas${mes ? ` de ${mes.toLowerCase()}` : ''}`}
          htmlFor={`cr-semanas-${indice}`}
          help="Las cuatro columnas a la derecha de los requisitos ISO 14001."
          wide
        >
          <SelectorSemanas
            id={`cr-semanas-${indice}`}
            value={seccion.semanas}
            onChange={(valor) => onChange({ semanas: valor })}
          />
        </Field>
      </FieldGrid>

      <div className="space-y-3">
        {dependencias.length === 0 && (
          <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-4 text-center text-xs text-muted-foreground">
            Este proceso no se audita en el programa. Añade una dependencia si sí se audita.
          </p>
        )}

        {dependencias.map((dep, i) => (
          <article
            key={i}
            className="space-y-3 rounded-xl border border-border bg-background p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none"
          >
            <header className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Dependencia #{i + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => eliminar(i)}
                title={`Quitar la dependencia #${i + 1}`}
                className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Quitar la dependencia #{i + 1}</span>
              </Button>
            </header>

            <FieldGrid columns={2}>
              <Field
                label="Dependencia auditada"
                htmlFor={`cr-aud-${indice}-${i}`}
                required
                help="Las del proceso; puedes escribir otra si hace falta"
                error={
                  marcarErrores && !String(dep.auditado || '').trim()
                    ? 'Indica qué dependencia se audita.'
                    : undefined
                }
                action={
                  <BotonMas
                    title="Crear una dependencia nueva"
                    onClick={() => setAlta({ tipo: 'dependencia', linea: i })}
                  />
                }
              >
                <Combobox
                  id={`cr-aud-${indice}-${i}`}
                  value={dep.auditado ?? ''}
                  options={disponibles}
                  onChange={(valor) => cambiarDependencia(i, { auditado: valor })}
                  placeholder="Busca una dependencia…"
                />
              </Field>

              <Field
                label="Auditor(es)"
                htmlFor={`cr-auditores-${indice}-${i}`}
                help="Añade los que hagan falta"
                action={
                  <BotonMas
                    title="Crear un auditor nuevo"
                    onClick={() => setAlta({ tipo: 'auditor', linea: i })}
                  />
                }
              >
                <ComboboxMultiple
                  id={`cr-auditores-${indice}-${i}`}
                  value={dep.auditores ?? ''}
                  options={opciones.auditores}
                  onChange={(valor) => cambiarDependencia(i, { auditores: valor })}
                  placeholder="Busca un auditor…"
                />
              </Field>

              {/* Texto libre y no un desplegable: suele ser alguien que no está
                  en el catálogo de usuarios. Es la «AA» de la nomenclatura. */}
              <Field
                label="Auditor acompañante"
                htmlFor={`cr-acomp-${indice}-${i}`}
                help="Opcional. Texto libre; sale como «AA:» junto a los auditores."
                wide
              >
                <Input
                  id={`cr-acomp-${indice}-${i}`}
                  value={dep.auditor_acompanante ?? ''}
                  onChange={(e) =>
                    cambiarDependencia(i, { auditor_acompanante: e.target.value })
                  }
                  placeholder="Nombre de quien acompaña"
                />
              </Field>
            </FieldGrid>
          </article>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={anadir} className="w-full">
          <Plus />
          Añadir dependencia a {seccion.proceso}
        </Button>
      </div>

      {/* Altas rápidas. Van aquí y no en cada línea: solo puede haber una
          abierta a la vez, y `alta.linea` dice a cuál devolver lo creado. */}
      <NuevaDependenciaDialog
        open={alta?.tipo === 'dependencia'}
        onOpenChange={(abierto) => !abierto && setAlta(null)}
        procesoClave={seccion.proceso_clave}
        onCreada={(creada) => {
          cambiarDependencia(alta.linea, { auditado: creada.nombre })
          onCatalogoCambiado()
        }}
      />

      <NuevoAuditorDialog
        open={alta?.tipo === 'auditor'}
        onOpenChange={(abierto) => !abierto && setAlta(null)}
        onCreado={(creado) => {
          // El catálogo identifica a las personas por «nombre apellido»; se
          // compone igual aquí para que la línea case con el desplegable.
          const nombre =
            [creado.nombre, creado.apellido].filter(Boolean).join(' ').trim() || creado.email

          const actuales = String(dependencias[alta.linea]?.auditores ?? '').trim()
          cambiarDependencia(alta.linea, {
            auditores: actuales ? `${actuales}, ${nombre}` : nombre,
          })
          onCatalogoCambiado()
        }}
      />
    </FormSection>
  )
}

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

/** «a», «a y b», «a, b y c». */
function enumerar(partes) {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
}

export function ProgramaDrawer({ open, onOpenChange, programa, onGuardar, guardando }) {
  const [tab, setTab] = useState('cabecera')
  const [form, setForm] = useState(formInicial)
  const [cronograma, setCronograma] = useState([])

  /** Si ya se intentó continuar: hasta entonces no se pinta nada en rojo. */
  const [intentado, setIntentado] = useState(false)

  /** Principio del contenido, para volver arriba al cambiar de pestaña. */
  const inicio = useRef(null)

  const editando = Boolean(programa?.id)

  // Los catálogos solo se piden con el panel abierto, y una sola vez por apertura.
  const {
    opciones,
    cargando: cargandoCatalogos,
    recargar: recargarCatalogos,
    derivarDeDependencia,
    dependenciasDeProceso,
    personaPorNombre,
  } = useCatalogosPrograma(open)

  // Al abrir: carga el programa a editar, o parte de los textos del formato.
  useEffect(() => {
    if (!open) return

    if (programa) {
      const { cronograma: cr, ...resto } = programa
      // `distribucion` no entra al formulario: se recalcula al guardar.
      const { distribucion, ...cabecera } = resto
      void distribucion

      setForm({
        ...formInicial(),
        ...cabecera,
        fecha_aprobacion: cabecera.fecha_aprobacion ?? '',
        // Un programa guardado sin listas llega con `null`, no con `[]`.
        riesgos: cabecera.riesgos ?? [],
        controles: cabecera.controles ?? [],
        oportunidades: cabecera.oportunidades ?? [],
      })
      setCronograma(conLasSeisSecciones(cr))
    } else {
      setForm(formInicial())
      setCronograma(cronogramaInicial())
    }
    setTab('cabecera')
    setIntentado(false)
  }, [open, programa])

  // Cada pestaña empieza por su principio: el panel es largo y, sin esto, al
  // pasar al cronograma aparecía a la altura a la que se había quedado la
  // cabecera, ya empezado por la mitad.
  useEffect(() => {
    subirAlInicio(inicio.current)
  }, [tab])

  /** `set('campo', valor)` o `set({ campo: valor, otro: valor })`. */
  const set = (campoOParche, valor) =>
    setForm((prev) => ({
      ...prev,
      ...(typeof campoOParche === 'string' ? { [campoOParche]: valor } : campoOParche),
    }))

  /**
   * Al crear, la cabecera es el primer paso de dos.
   *
   * El botón principal lleva al cronograma en vez de guardar, porque un
   * programa sin él no sirve de mucho. Editando no se hace: quien entra a
   * corregir una frase del objetivo no tiene por qué recorrer las pestañas.
   */
  const esPrimerPaso = !editando && tab === 'cabecera'

  const sinNombre = !String(form.nombre || '').trim()
  // El campo admite texto libre, pero la columna tiene un CHECK.
  const estadoInvalido = !ESTADOS.some((e) => e.value === form.estado)
  // Las seis secciones están siempre; lo que hace falta es que alguna tenga
  // dependencias. Un cronograma con los seis procesos vacíos no programa nada.
  const dependenciasCronograma = totalDependenciasCronograma(cronograma)
  const cronogramaVacio = dependenciasCronograma === 0
  const cronogramaIncompleto = cronograma.some((seccion) =>
    (seccion.dependencias ?? []).some((dep) => !String(dep.auditado || '').trim())
  )

  /**
   * Lo que impide continuar, en texto.
   *
   * Se dice en el pie, junto al botón: el aviso emergente se va a los tres
   * segundos y quien lo pierde se queda mirando un botón que no avanza.
   */
  const faltantes = [
    sinNombre && 'el nombre del programa',
    estadoInvalido && 'un estado válido',
    !esPrimerPaso && cronogramaVacio && 'al menos una dependencia en algún proceso',
    !esPrimerPaso && cronogramaIncompleto && 'la dependencia auditada en cada línea',
  ].filter(Boolean)

  const handleSubmit = (e) => {
    e.preventDefault()
    setIntentado(true)

    if (sinNombre) {
      toast.error('El nombre del programa es obligatorio.')
      setTab('cabecera')
      return
    }

    if (estadoInvalido) {
      toast.error('El estado debe ser borrador, aprobado o archivado.')
      setTab('cabecera')
      return
    }

    if (esPrimerPaso) {
      setTab('cronograma')
      return
    }

    if (cronogramaVacio) {
      toast.error('Añade al menos una dependencia a algún proceso del cronograma.')
      setTab('cronograma')
      return
    }

    if (cronogramaIncompleto) {
      toast.error('Cada línea del cronograma necesita la dependencia auditada.')
      setTab('cronograma')
      return
    }

    // La distribución no se teclea: sale del cronograma y del catálogo.
    onGuardar({
      ...form,
      cronograma,
      distribucion: distribucionDesdeCronograma(cronograma, {
        derivarDeDependencia,
        personaPorNombre,
      }),
    })
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editando ? `Programa ${form.anio} — ${form.nombre}` : 'Nuevo programa de auditoría'}
      description="Formato PE-GS-2.2.1-FOR-7. Los textos institucionales vienen precargados y son editables."
      onSubmit={handleSubmit}
      submitting={guardando}
      submitLabel={
        editando ? 'Guardar cambios' : esPrimerPaso ? 'Siguiente' : 'Crear programa'
      }
      headerExtra={
        <ViewToggle options={PESTANAS} value={tab} onChange={setTab} className="mt-3 self-start" />
      }
      footerInfo={
        intentado && faltantes.length ? (
          <span className="font-medium text-destructive">Falta {enumerar(faltantes)}.</span>
        ) : (
          <span>
            {dependenciasCronograma} dependencia{dependenciasCronograma === 1 ? '' : 's'} en el
            cronograma
          </span>
        )
      }
    >
      {/* Ancla del principio: al cambiar de pestaña se vuelve aquí. */}
      <span ref={inicio} aria-hidden className="block" />

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

              <Field
                label="Nombre del programa"
                htmlFor="pa-nombre"
                required
                error={intentado && sinNombre ? 'Escribe un nombre para el programa.' : undefined}
              >
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
                <DatePicker
                  id="pa-fecha"
                  value={form.fecha_aprobacion ?? ''}
                  onChange={(v) => set('fecha_aprobacion', v)}
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
        <>
          <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-3 text-xs text-muted-foreground">
            Una sección por proceso del mapa institucional. Los requisitos y las semanas son del
            proceso entero; lo que cambia en cada línea es la dependencia auditada y sus auditores.
            {cargandoCatalogos && ' · Cargando catálogos…'}
          </p>

          {/* Aquí y no solo en el pie: el pie queda lejos si estás mirando la
              última sección, y el aviso emergente se va a los tres segundos. */}
          {intentado && cronogramaVacio && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              Ningún proceso tiene dependencias todavía. Añade al menos una al proceso que se vaya a
              auditar; los que no se auditen se quedan vacíos y no salen en el Excel.
            </p>
          )}

          {cronograma.map((seccion, indice) => (
            <SeccionCronograma
              key={`${seccion.proceso_clave ?? seccion.proceso}-${indice}`}
              seccion={seccion}
              indice={indice}
              mes={form.mes_auditoria}
              opciones={opciones}
              dependenciasDeProceso={dependenciasDeProceso}
              marcarErrores={intentado}
              onCatalogoCambiado={recargarCatalogos}
              onChange={(parche) =>
                setCronograma((prev) =>
                  prev.map((s, i) => (i === indice ? { ...s, ...parche } : s))
                )
              }
            />
          ))}
        </>
      )}
    </FormDrawer>
  )
}
