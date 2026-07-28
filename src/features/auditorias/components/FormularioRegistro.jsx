'use client'

/**
 * Formulario del informe de auditoría.
 *
 * Los tres tipos de hallazgo (fortaleza, oportunidad de mejora y no
 * conformidad) comparten estructura exacta —ISO / capítulo / numeral + dos
 * campos de texto—, así que se describen como datos en `TIPOS_HALLAZGO` y se
 * renderizan con un solo componente. Antes eran tres bloques de JSX casi
 * idénticos de ~120 líneas cada uno.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import { ArrowLeft, CircleHelp, FileText, Plus, Save, X } from 'lucide-react'

import { supabase } from '@/lib/supabase/client'
import { enfocarNuevo } from '@/lib/dom/desplazar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, FieldGrid } from '@/components/ui/field'
import { FormSection } from '@/components/ui/form-section'
import { Input, Textarea } from '@/components/ui/input'
import { PageHeader, HeaderStat } from '@/components/ui/page-header'
import { StickyBar } from '@/components/ui/sticky-bar'
import {
  Dialog,
  DialogContent,
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
import { PAGE_SHELL } from '@/components/ui/tokens'

/* ------------------------------------------------------------------ *
 * Configuración de los tipos de hallazgo
 * ------------------------------------------------------------------ */

/**
 * @typedef {Object} TipoHallazgo
 * @property {string} key       Clave dentro del estado `hallazgos`
 * @property {string} tabla     Tabla de Supabase donde se persiste
 * @property {string} singular  Título de cada tarjeta
 * @property {string} plural    Texto del botón para añadir
 * @property {string} rotulo   Color del rótulo en versalitas
 * @property {string} guia      Instrucción que ve el auditor
 * @property {string} ayuda     Imagen de ayuda (ruta absoluta desde /public)
 * @property {{name: string, label: string}[]} campos  Campos de texto propios
 * @property {string} tarjeta   Clases de la tarjeta
 * @property {string} boton     Clases del botón para añadir
 */

/** @type {TipoHallazgo[]} */
const TIPOS_HALLAZGO = [
  {
    key: 'fortalezas',
    tabla: 'fortalezas',
    singular: 'Fortaleza',
    plural: 'Fortalezas',
    emoji: '💪',
    guia: 'Describir las fortalezas (buenas prácticas identificadas), para ser replicadas en la institución (citar si las hay).',
    ayuda: '/ayudas/AyudaFortalezas.png',
    campos: [
      { name: 'descripcion', label: 'Descripción' },
      { name: 'razon', label: 'Razón' },
    ],
    tarjeta:
      'border-emerald-300/90 border-l-emerald-500 bg-emerald-50/40 dark:border-emerald-800/70 dark:border-l-emerald-500 dark:bg-emerald-950/20',
    rotulo: 'text-emerald-800 dark:text-emerald-300',
    boton: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
  },
  {
    key: 'oportunidades',
    tabla: 'oportunidades_mejora',
    singular: 'Oportunidad de mejora',
    plural: 'Oportunidades de mejora',
    emoji: '📈',
    guia: 'Describir los requisitos susceptibles de mejora priorizados, que sean posibles de ejecutar, con respecto a los criterios de auditoría y la lista de chequeo (tenga en cuenta que el número no exceda de 4).',
    ayuda: '/ayudas/AyudaOportunidad.png',
    campos: [
      { name: 'descripcion', label: 'Descripción' },
      { name: 'para_que', label: '¿Para qué?' },
    ],
    tarjeta:
      'border-sky-300/90 border-l-sky-500 bg-sky-50/40 dark:border-sky-800/70 dark:border-l-sky-500 dark:bg-sky-950/20',
    rotulo: 'text-sky-800 dark:text-sky-300',
    boton: 'border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40',
  },
  {
    key: 'noConformidades',
    tabla: 'no_conformidades',
    singular: 'No conformidad',
    plural: 'No conformidades',
    emoji: '🚫',
    guia: 'Incumplimiento de requisitos (No Conformidades) que demandan Acciones Correctivas.',
    ayuda: '/ayudas/AyudaNoConformidad.png',
    campos: [
      { name: 'descripcion', label: 'Descripción' },
      { name: 'evidencia', label: 'Evidencia' },
    ],
    tarjeta:
      'border-amber-300/90 border-l-amber-500 bg-amber-50/40 dark:border-amber-800/70 dark:border-l-amber-500 dark:bg-amber-950/20',
    rotulo: 'text-amber-800 dark:text-amber-300',
    boton: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40',
  },
]

/** Fila vacía de un tipo de hallazgo. */
const hallazgoVacio = (tipo) => ({
  iso: '',
  capitulo: '',
  numeral: '',
  ...Object.fromEntries(tipo.campos.map((c) => [c.name, ''])),
})

/** Estado inicial: un array vacío por tipo. */
const HALLAZGOS_INICIALES = Object.fromEntries(TIPOS_HALLAZGO.map((t) => [t.key, []]))

const FORM_INICIAL = {
  fecha_auditoria: '',
  asistencia_tipo: 'Digital',
  auditores_acompanantes: '',
  objetivo: '',
  criterios: '',
  conclusiones: '',
  fecha_seguimiento: '',
  recomendaciones: '',
}

/** Textos de los campos obligatorios del informe. */
const OBLIGATORIOS = [
  ['fecha_auditoria', 'La fecha de auditoría es obligatoria.'],
  ['asistencia_tipo', 'El tipo de asistencia es obligatorio.'],
  ['objetivo', 'El objetivo es obligatorio.'],
  ['criterios', 'Los criterios son obligatorios.'],
  ['conclusiones', 'Las conclusiones son obligatorias.'],
  ['fecha_seguimiento', 'La fecha de seguimiento es obligatoria.'],
  ['recomendaciones', 'Las recomendaciones son obligatorias.'],
]

/**
 * Los cuatro apartados de texto del informe.
 *
 * `ayuda` es la imagen guía; solo la tienen los dos que la gente pregunta más.
 */
const CAMPOS_INFORME = [
  {
    name: 'objetivo',
    label: 'Objetivo de la auditoría',
    placeholder: 'Para qué se hizo esta auditoría…',
  },
  {
    name: 'criterios',
    label: 'Criterios de la auditoría',
    placeholder: 'Normas, procedimientos y documentos contra los que se auditó…',
  },
  {
    name: 'conclusiones',
    label: 'Conclusiones',
    placeholder: 'Qué se concluye del ejercicio…',
    ayuda: '/ayudas/AyudaFortalezas.png',
  },
  {
    name: 'recomendaciones',
    label: 'Recomendaciones',
    placeholder: 'Qué se recomienda a la dependencia auditada…',
    ayuda: '/ayudas/AyudaFortalezas.png',
  },
]

/** `''` → `null`: Postgres rechaza la cadena vacía en columnas enteras. */
const idONulo = (v) => (v === '' || v === undefined ? null : v)

/* ------------------------------------------------------------------ *
 * Piezas de UI
 * ------------------------------------------------------------------ */

/**
 * Textarea que crece con su contenido.
 *
 * Antes esto se hacía recorriendo el DOM con `querySelectorAll` y añadiendo un
 * listener `input` en cada render **sin quitarlo nunca**, así que los listeners
 * se acumulaban mientras se editaba el formulario.
 */
function AutoTextarea({ className, value, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <Textarea
      ref={ref}
      value={value}
      // Sin `lang` propio: hereda el `es` de <html>. Fijar `es-ES` obligaba a
      // Chrome a ese diccionario concreto, que no todo el mundo tiene activo.
      spellCheck="true"
      autoComplete="off"
      rows={1}
      className={cn('max-h-[500px] resize-y overflow-y-auto leading-relaxed', className)}
      {...props}
    />
  )
}

/** Botón circular de ayuda; abre la imagen guía del bloque. */
function BotonAyuda({ onClick, titulo }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      title={titulo}
      className="h-8 w-8 shrink-0 rounded-full border-sky-300 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:border-sky-800 dark:hover:bg-sky-950"
    >
      <CircleHelp />
      <span className="sr-only">{titulo}</span>
    </Button>
  )
}

/** Un `<select>` de catálogo (ISO / capítulo / numeral). */
function SelectCatalogo({ id, label, value, onChange, opciones, etiquetaOpcion, placeholder, disabled }) {
  return (
    <Field label={label} htmlFor={id} className="min-w-[180px] flex-1">
      <Select
        value={value ? String(value) : undefined}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.id} value={String(o.id)}>
              {etiquetaOpcion(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/* ------------------------------------------------------------------ *
 * Componente principal
 * ------------------------------------------------------------------ */

/**
 * @param {Object} props
 * @param {Object} props.usuario
 * @param {Object} [props.auditoria]   Informe a editar; si falta, se crea uno nuevo
 * @param {Function} [props.onSuccess] Tras guardar
 * @param {Function} [props.onVolver]  Botón de volver / cancelar
 * @param {boolean} [props.embebido]   Dentro de un drawer: sin PageHeader propio
 */
export default function FormularioRegistro({
  usuario,
  auditoria,
  onSuccess,
  onVolver,
  embebido = false,
}) {
  const [form, setForm] = useState(FORM_INICIAL)
  const [hallazgos, setHallazgos] = useState(HALLAZGOS_INICIALES)
  const [listaIso, setListaIso] = useState([])
  const [listaCapitulos, setListaCapitulos] = useState({})
  const [listaNumerales, setListaNumerales] = useState({})
  const [loading, setLoading] = useState(false)
  const [errores, setErrores] = useState({})
  const [ayudaImagen, setAyudaImagen] = useState(null)

  const router = useRouter()

  /** Tarjeta de cada hallazgo, indexada por `${tipo}-${posición}`. */
  const tarjetas = useRef({})

  /** Clave de la tarjeta recién añadida, para llevar el foco hasta ella. */
  const [hallazgoNuevo, setHallazgoNuevo] = useState(null)

  /* ── Catálogos ── */

  useEffect(() => {
    supabase
      .from('iso')
      .select('*')
      .then(({ data }) => {
        if (data) setListaIso(data)
      })
  }, [])

  const cargarCapitulos = useCallback(async (isoId) => {
    if (!isoId) return
    const { data } = await supabase.from('capitulos').select('*').eq('iso_id', isoId)
    if (data) setListaCapitulos((prev) => ({ ...prev, [isoId]: data }))
  }, [])

  const cargarNumerales = useCallback(async (capituloId) => {
    if (!capituloId) return
    const { data } = await supabase.from('numerales').select('*').eq('capitulo_id', capituloId)
    if (data) setListaNumerales((prev) => ({ ...prev, [capituloId]: data }))
  }, [])

  /* ── Carga del informe existente ── */

  useEffect(() => {
    if (!auditoria) return

    setForm({
      fecha_auditoria: auditoria.fecha_auditoria || '',
      asistencia_tipo: auditoria.asistencia_tipo || 'Digital',
      auditores_acompanantes: (auditoria.auditores_acompanantes || []).join(', '),
      objetivo: auditoria.objetivo || '',
      criterios: auditoria.criterios || '',
      conclusiones: auditoria.conclusiones || '',
      fecha_seguimiento: auditoria.fecha_seguimiento || '',
      recomendaciones: auditoria.recomendaciones || '',
    })

    const cargarHallazgos = async () => {
      const respuestas = await Promise.all(
        TIPOS_HALLAZGO.map((t) =>
          supabase.from(t.tabla).select('*').eq('informe_id', auditoria.id)
        )
      )

      const cargados = {}
      TIPOS_HALLAZGO.forEach((tipo, i) => {
        cargados[tipo.key] = (respuestas[i].data || []).map((fila) => ({
          iso: fila.iso_id ?? '',
          capitulo: fila.capitulo_id ?? '',
          numeral: fila.numeral_id ?? '',
          ...Object.fromEntries(tipo.campos.map((c) => [c.name, fila[c.name] ?? ''])),
        }))
      })
      setHallazgos(cargados)

      // Los catálogos de los hallazgos ya guardados se piden en dos consultas,
      // no una por fila: antes el bucle con `await` disparaba una consulta por
      // hallazgo y la caché en estado aún no se había aplicado, así que las
      // repetía.
      const filas = Object.values(cargados).flat()
      const isos = [...new Set(filas.map((f) => f.iso).filter(Boolean))]
      const capitulos = [...new Set(filas.map((f) => f.capitulo).filter(Boolean))]

      if (isos.length) {
        const { data } = await supabase.from('capitulos').select('*').in('iso_id', isos)
        if (data) setListaCapitulos((prev) => ({ ...prev, ...agruparPor(data, 'iso_id') }))
      }
      if (capitulos.length) {
        const { data } = await supabase.from('numerales').select('*').in('capitulo_id', capitulos)
        if (data) setListaNumerales((prev) => ({ ...prev, ...agruparPor(data, 'capitulo_id') }))
      }
    }

    cargarHallazgos()
  }, [auditoria])

  /* ── Cambios en el informe ── */

  /**
    * El texto se guarda tal cual se escribe.
    *
    * Antes se pasaba todo a mayúsculas al salir del campo, y eso apagaba el
    * corrector ortográfico: los navegadores no marcan las palabras en
    * mayúsculas porque las tratan como siglas.
    */
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  /* ── Cambios en los hallazgos ── */

  const actualizarHallazgo = useCallback((tipoKey, index, campo, valor) => {
    setHallazgos((prev) => {
      const lista = [...prev[tipoKey]]
      lista[index] = { ...lista[index], [campo]: valor }
      return { ...prev, [tipoKey]: lista }
    })
  }, [])

  const eliminarHallazgo = useCallback((tipoKey, index) => {
    setHallazgos((prev) => ({
      ...prev,
      [tipoKey]: prev[tipoKey].filter((_, i) => i !== index),
    }))
  }, [])

  const agregarHallazgo = (tipo) => {
    const posicion = hallazgos[tipo.key].length
    setHallazgos((prev) => ({ ...prev, [tipo.key]: [...prev[tipo.key], hallazgoVacio(tipo)] }))
    setHallazgoNuevo(`${tipo.key}-${posicion}`)
  }

  /** Lleva la vista y el foco a la tarjeta recién añadida. */
  useEffect(() => {
    if (!hallazgoNuevo) return

    // El primer control es el selector de ISO; así se puede seguir escribiendo
    // sin volver a coger el ratón.
    enfocarNuevo(tarjetas.current[hallazgoNuevo])

    setHallazgoNuevo(null)
  }, [hallazgoNuevo])

  /* ── Guardado ── */

  const validarFormulario = () => {
    const nuevosErrores = {}

    for (const [campo, mensaje] of OBLIGATORIOS) {
      const valor = form[campo]
      if (!valor || !String(valor).trim()) nuevosErrores[campo] = mensaje
    }

    // Un hallazgo sin descripción llegaba a la base de datos como fila vacía.
    for (const tipo of TIPOS_HALLAZGO) {
      hallazgos[tipo.key].forEach((h, i) => {
        if (!String(h.descripcion || '').trim()) {
          nuevosErrores[`${tipo.key}.${i}.descripcion`] =
            `Describe ${tipo.singular.toLowerCase()} #${i + 1} o elimínala.`
        }
      })
    }

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    if (!validarFormulario()) {
      toast.error('Por favor completa todos los campos obligatorios.')
      return
    }
    setLoading(true)

    const payload = {
      ...form,
      auditores_acompanantes: form.auditores_acompanantes
        ? form.auditores_acompanantes.split(',').map((s) => s.trim())
        : [],
    }

    try {
      let informeId

      if (auditoria) {
        const { error } = await supabase
          .from('informes_auditoria')
          .update(payload)
          .eq('id', auditoria.id)
        if (error) throw error
        informeId = auditoria.id

        // Los hallazgos se reescriben enteros en cada guardado.
        await Promise.all(
          TIPOS_HALLAZGO.map((t) => supabase.from(t.tabla).delete().eq('informe_id', informeId))
        )
      } else {
        const { data: nueva, error } = await supabase
          .from('informes_auditoria')
          .insert({
            ...payload,
            usuario_id: usuario.usuario_id,
            dependencia_id: usuario.dependencia_id,
          })
          .select()
          .single()
        if (error) throw error
        informeId = nueva.id
      }

      // Un `insert` por tipo con todas sus filas, en lugar de uno por hallazgo.
      for (const tipo of TIPOS_HALLAZGO) {
        const filas = hallazgos[tipo.key].map((h) => ({
          informe_id: informeId,
          iso_id: idONulo(h.iso),
          capitulo_id: idONulo(h.capitulo),
          numeral_id: idONulo(h.numeral),
          ...Object.fromEntries(tipo.campos.map((c) => [c.name, h[c.name] || null])),
        }))
        if (!filas.length) continue

        const { error } = await supabase.from(tipo.tabla).insert(filas)
        if (error) throw error
      }

      toast.success('Informe y hallazgos guardados correctamente')

      if (onSuccess) {
        onSuccess()
      } else if (onVolver) {
        onVolver()
      } else {
        localStorage.setItem('vistaAuditor', 'bienvenida')
        router.push('/auditor?vista=bienvenida')
      }
    } catch (err) {
      console.error('❌ Error al guardar:', err)
      toast.error(err?.message || 'Error al guardar informe y hallazgos')
    } finally {
      setLoading(false)
    }
  }

  /* ── Render ── */

  const anioAuditoria = useMemo(() => {
    if (!auditoria?.fecha_auditoria) return null
    const anio = new Date(auditoria.fecha_auditoria).getFullYear()
    // 1969 es el año que sale cuando la fecha viene vacía o inválida.
    return Number.isNaN(anio) || anio === 1969 ? null : anio
  }, [auditoria])

  const totalHallazgos = TIPOS_HALLAZGO.reduce((n, t) => n + hallazgos[t.key].length, 0)

  /** Cuántos campos obligatorios están rellenos, para las barras de avance. */
  const obligatoriosCompletos = OBLIGATORIOS.filter(([campo]) =>
    String(form[campo] || '').trim()
  ).length
  const contenidoCompleto = CAMPOS_INFORME.filter((c) => String(form[c.name] || '').trim()).length
  const progreso = Math.round((obligatoriosCompletos / OBLIGATORIOS.length) * 100)
  const faltan = OBLIGATORIOS.length - obligatoriosCompletos

  /** Chip de avance «3/4» para la cabecera de una sección. */
  const Avance = ({ hechos, total }) => (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums',
        hechos === total
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-border bg-background text-muted-foreground'
      )}
    >
      {hechos}/{total} completados
    </span>
  )

  return (
    <div className={embebido ? 'flex flex-col gap-4' : PAGE_SHELL}>
      {/* En un drawer la cabecera la pone el propio panel. */}
      {!embebido && (
        <PageHeader
          icon={<FileText />}
          title={auditoria ? 'Informe de auditoría' : 'Nuevo informe de auditoría'}
          subtitle={
            auditoria
              ? `${auditoria.dependencias?.nombre || 'Dependencia no encontrada'}${
                  anioAuditoria ? ` · ${anioAuditoria}` : ''
                }`
              : 'Registra el resultado de la auditoría y sus hallazgos.'
          }
          stats={
            auditoria ? (
              <>
                <HeaderStat label="Auditoría" value={`#${auditoria.id}`} />
                <HeaderStat label="Avance" value={`${progreso}%`} />
                <HeaderStat label="Hallazgos" value={totalHallazgos} />
              </>
            ) : null
          }
          actions={
            onVolver ? (
              <Button
                type="button"
                variant="secondary"
                onClick={onVolver}
                className="bg-white/15 text-white hover:bg-white/25"
              >
                <ArrowLeft />
                Volver
              </Button>
            ) : null
          }
        />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* ── Datos generales ── */}
        <FormSection
          title="Datos de la auditoría"
          description="Cuándo se hizo, cómo se atendió y quién acompañó."
        >
          <FieldGrid>
            <Field
              label="Fecha de la auditoría"
              htmlFor="fecha_auditoria"
              required
              error={errores.fecha_auditoria}
            >
              <Input
                type="date"
                id="fecha_auditoria"
                name="fecha_auditoria"
                value={form.fecha_auditoria}
                onChange={handleChange}
              />
            </Field>

            <Field
              label="Fecha de seguimiento"
              htmlFor="fecha_seguimiento"
              required
              error={errores.fecha_seguimiento}
              help="Resolución 290 de 2019 de la Universidad del Cauca."
            >
              <Input
                type="date"
                id="fecha_seguimiento"
                name="fecha_seguimiento"
                value={form.fecha_seguimiento}
                onChange={handleChange}
              />
            </Field>

            <Field
              label="Asistencia"
              htmlFor="asistencia_tipo"
              required
              error={errores.asistencia_tipo}
            >
              <Select
                value={form.asistencia_tipo}
                onValueChange={(v) => setForm((prev) => ({ ...prev, asistencia_tipo: v }))}
              >
                <SelectTrigger id="asistencia_tipo">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Digital">Digital</SelectItem>
                  <SelectItem value="Físico">Físico</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          tone="optional"
          title="Campos opcionales"
          description="Puedes dejarlo en blanco si auditaste en solitario."
        >
          <FieldGrid>
            <Field
              label="Auditores acompañantes"
              htmlFor="auditores_acompanantes"
              help="Separa cada nombre con una coma."
            >
              <Input
                id="auditores_acompanantes"
                name="auditores_acompanantes"
                value={form.auditores_acompanantes}
                onChange={handleChange}
                placeholder="Ana Pérez, Luis Gómez"
              />
            </Field>
          </FieldGrid>
        </FormSection>

        {/* ── Contenido del informe ── */}
        <FormSection
          title="Contenido del informe"
          description="Los cuatro apartados que se imprimen en el documento final."
          actions={
            <>
              <span className="text-[11px] text-muted-foreground">✓ Corrector ortográfico</span>
              <Avance hechos={contenidoCompleto} total={CAMPOS_INFORME.length} />
            </>
          }
        >
          <div className="grid gap-4">
            {CAMPOS_INFORME.map((campo) => (
              <Field
                key={campo.name}
                label={campo.label}
                htmlFor={campo.name}
                required
                error={errores[campo.name]}
                action={
                  campo.ayuda && (
                    <BotonAyuda
                      titulo={`Ayuda para ${campo.label.toLowerCase()}`}
                      onClick={() => setAyudaImagen(campo.ayuda)}
                    />
                  )
                }
              >
                <AutoTextarea
                  id={campo.name}
                  name={campo.name}
                  value={form[campo.name]}
                  onChange={handleChange}
                  placeholder={campo.placeholder}
                  className="min-h-[88px] bg-background"
                />
              </Field>
            ))}
          </div>
        </FormSection>

        {/* ── Hallazgos ── */}
        <FormSection
          tone="optional"
          title="Hallazgos"
          description="Opcionales, pero son lo que alimenta el Plan de Mejoramiento."
          actions={
            totalHallazgos > 0 && (
              <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {totalHallazgos} registrado{totalHallazgos === 1 ? '' : 's'}
              </span>
            )
          }
        >
          {/* Los botones van arriba: con muchos hallazgos, tenerlos al final
              obligaba a recorrer toda la lista para añadir uno más. */}
          <div className="grid gap-2 sm:grid-cols-3">
            {TIPOS_HALLAZGO.map((tipo) => (
              <Button
                key={tipo.key}
                type="button"
                variant="outline"
                onClick={() => agregarHallazgo(tipo)}
                className={cn('h-auto justify-start gap-2 bg-background py-2.5 text-sm', tipo.boton)}
              >
                <Plus />
                <span className="font-semibold">{tipo.plural}</span>
                <span className="ml-auto text-xs tabular-nums opacity-70">
                  {hallazgos[tipo.key].length}
                </span>
              </Button>
            ))}
          </div>

          {totalHallazgos === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-muted-foreground">
              Todavía no has registrado hallazgos. Usa los botones de arriba para añadir una
              fortaleza, una oportunidad de mejora o una no conformidad.
            </p>
          )}

          {TIPOS_HALLAZGO.map((tipo) =>
            hallazgos[tipo.key].map((hallazgo, i) => (
              <article
                key={`${tipo.key}-${i}`}
                ref={(el) => {
                  tarjetas.current[`${tipo.key}-${i}`] = el
                }}
                className={cn(
                  // `scroll-mt-4`: al desplazarse hasta ella deja un respiro
                  // arriba en vez de pegarse al borde del panel.
                  'animate-fade-in relative scroll-mt-4 space-y-3 rounded-2xl border border-l-[5px] p-4',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-none',
                  tipo.tarjeta
                )}
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-[11px] font-semibold uppercase tracking-[0.14em]',
                        tipo.rotulo
                      )}
                    >
                      {tipo.singular} #{i + 1}
                    </p>
                    <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{tipo.guia}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <BotonAyuda
                      titulo={`Ayuda para ${tipo.singular.toLowerCase()}`}
                      onClick={() => setAyudaImagen(tipo.ayuda)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarHallazgo(tipo.key, i)}
                      title={`Eliminar ${tipo.singular.toLowerCase()} #${i + 1}`}
                      className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">
                        Eliminar {tipo.singular.toLowerCase()} #{i + 1}
                      </span>
                    </Button>
                  </div>
                </header>

                <FieldGrid>
                  <SelectCatalogo
                    id={`${tipo.key}-iso-${i}`}
                    label="ISO"
                    value={hallazgo.iso}
                    placeholder="Seleccionar ISO"
                    opciones={listaIso}
                    etiquetaOpcion={(o) => o.iso}
                    onChange={(isoId) => {
                      setHallazgos((prev) => {
                        const lista = [...prev[tipo.key]]
                        lista[i] = { ...lista[i], iso: isoId, capitulo: '', numeral: '' }
                        return { ...prev, [tipo.key]: lista }
                      })
                      cargarCapitulos(isoId)
                    }}
                  />

                  <SelectCatalogo
                    id={`${tipo.key}-capitulo-${i}`}
                    label="Capítulo"
                    value={hallazgo.capitulo}
                    placeholder="Capítulo"
                    disabled={!hallazgo.iso}
                    opciones={listaCapitulos[hallazgo.iso] || []}
                    etiquetaOpcion={(o) => o.capitulo}
                    onChange={(capId) => {
                      setHallazgos((prev) => {
                        const lista = [...prev[tipo.key]]
                        lista[i] = { ...lista[i], capitulo: capId, numeral: '' }
                        return { ...prev, [tipo.key]: lista }
                      })
                      cargarNumerales(capId)
                    }}
                  />

                  <SelectCatalogo
                    id={`${tipo.key}-numeral-${i}`}
                    label="Numeral"
                    value={hallazgo.numeral}
                    placeholder="Numeral"
                    disabled={!hallazgo.capitulo}
                    opciones={listaNumerales[hallazgo.capitulo] || []}
                    etiquetaOpcion={(o) => o.numeral}
                    onChange={(numId) => actualizarHallazgo(tipo.key, i, 'numeral', numId)}
                  />
                </FieldGrid>

                <div className="grid gap-4">
                  {tipo.campos.map((campo) => (
                    <Field
                      key={campo.name}
                      label={campo.label}
                      htmlFor={`${tipo.key}-${campo.name}-${i}`}
                      error={errores[`${tipo.key}.${i}.${campo.name}`]}
                    >
                      <AutoTextarea
                        id={`${tipo.key}-${campo.name}-${i}`}
                        value={hallazgo[campo.name] || ''}
                        onChange={(e) =>
                          actualizarHallazgo(tipo.key, i, campo.name, e.target.value)
                        }
                        className="min-h-[72px] bg-background"
                      />
                    </Field>
                  ))}
                </div>
              </article>
            ))
          )}
        </FormSection>

        {/* Guardar siempre a la vista: el formulario es largo. */}
        <StickyBar
          info={
            <span className="flex items-center gap-2">
              <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                <span
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-300',
                    faltan === 0 ? 'bg-emerald-500' : 'bg-primary'
                  )}
                  style={{ width: `${progreso}%` }}
                />
              </span>
              {faltan === 0
                ? 'Todo lo obligatorio está completo'
                : `Faltan ${faltan} campo${faltan === 1 ? '' : 's'} obligatorio${faltan === 1 ? '' : 's'}`}
            </span>
          }
        >
          {onVolver && (
            <Button type="button" variant="outline" onClick={onVolver} disabled={loading}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            <Save />
            {loading ? 'Guardando…' : auditoria ? 'Actualizar informe' : 'Guardar informe'}
          </Button>
        </StickyBar>
      </form>

      {/* Imagen guía */}
      <Dialog open={Boolean(ayudaImagen)} onOpenChange={(open) => (open ? null : setAyudaImagen(null))}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Cómo diligenciar este bloque</DialogTitle>
          </DialogHeader>
          {ayudaImagen && (
            <Image
              src={ayudaImagen}
              alt="Ejemplo de cómo diligenciar el bloque"
              width={1400}
              height={900}
              className="h-auto max-h-[70vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Agrupa filas por el valor de una columna: `{ [valor]: filas[] }`. */
function agruparPor(filas, columna) {
  return filas.reduce((acc, fila) => {
    const clave = fila[columna]
    ;(acc[clave] ||= []).push(fila)
    return acc
  }, {})
}
