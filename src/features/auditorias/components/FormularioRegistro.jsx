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
import { ArrowLeft, CircleHelp, Plus, Save, Sparkles, X } from 'lucide-react'

import { supabase } from '@/lib/supabase/client'
import { validarAlineacion } from '@/features/auditorias/api/informes-api'
import {
  leerHallazgos,
  nuevoUid,
  resumenEscrito,
  sincronizarHallazgos,
} from '@/features/auditorias/lib/hallazgos-informe'
import { useGuardadoAutomatico } from '@/features/auditorias/hooks/useGuardadoAutomatico'
import { ASISTENCIA_TIPOS, esAsistenciaConocida } from '@/features/auditorias/lib/asistencia'
import {
  COLUMNAS_DEL_FORMULARIO,
  FORM_INICIAL,
  aFormulario,
  mezclarConfirmado,
} from '@/features/auditorias/lib/informe-formulario'
import { enfocarNuevo } from '@/lib/dom/desplazar'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
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
import { PAGE_SHELL, STATUS_BADGE_TONES } from '@/components/ui/tokens'
import { anioDe } from '@/lib/fechas'

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
  // `uid` identifica la tarjeta en el navegador y `id` la fila en la base, que
  // todavía no existe. Ver `lib/hallazgos-informe.js`.
  uid: nuevoUid(),
  id: null,
  iso: '',
  capitulo: '',
  numeral: '',
  ...Object.fromEntries(tipo.campos.map((c) => [c.name, ''])),
})

/** Estado inicial: un array vacío por tipo. */
const HALLAZGOS_INICIALES = Object.fromEntries(TIPOS_HALLAZGO.map((t) => [t.key, []]))

/**
 * Los campos que cuentan para el indicador de avance.
 *
 * **Ninguno es obligatorio.** El informe se rellena a lo largo de semanas y en
 * el orden que cada auditor prefiera —muchos anotan los hallazgos según los
 * encuentran y dejan las conclusiones para el final—, así que el formulario
 * guarda lo que haya en el momento en que se pulse guardar. Esta lista solo
 * alimenta la barra de «lo que queda»: informa, no impide.
 */
const CAMPOS_DEL_AVANCE = [
  'fecha_auditoria',
  'asistencia_tipo',
  'objetivo',
  'criterios',
  'conclusiones',
  'recomendaciones',
  'fecha_seguimiento',
]

/**
 * Los apartados de texto del informe, separados por el momento en que se
 * escriben.
 *
 * El encuadre —objetivo y criterios— se redacta antes de auditar: es lo que se
 * pactó revisar. El cierre —conclusiones y recomendaciones— solo se puede
 * escribir con los hallazgos delante, así que en el formulario va después de
 * ellos y no antes, que era donde estaba.
 *
 * `revisable` marca los dos que se pueden contrastar con la IA; cada uno lleva
 * su propio botón justo debajo.
 */
const CAMPOS_ENCUADRE = [
  {
    name: 'objetivo',
    label: 'Objetivo de la auditoría',
    placeholder: 'Para qué se hizo esta auditoría…',
    revisable: true,
  },
  {
    name: 'criterios',
    label: 'Criterios de la auditoría',
    placeholder: 'Normas, procedimientos y documentos contra los que se auditó…',
  },
]

const CAMPOS_CIERRE = [
  {
    name: 'conclusiones',
    label: 'Conclusiones',
    placeholder: 'Qué se concluye del ejercicio…',
    revisable: true,
  },
  {
    name: 'recomendaciones',
    label: 'Recomendaciones',
    placeholder: 'Qué se recomienda a la dependencia auditada…',
  },
]

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

/**
 * El objetivo del programa del que sale la auditoría.
 *
 * Va encima del objetivo del informe y **no se precarga en el campo**: el del
 * programa es general y el de cada auditoría es el suyo. Copiarlo dentro
 * invitaba a dejarlo tal cual, y entonces las veinte auditorías del año salían
 * con el mismo objetivo. Aquí se lee, se compara y se escribe el propio.
 *
 * Solo aparece si la auditoría se generó desde un programa; las creadas a mano
 * no tienen ninguno.
 */
function ObjetivoDelPrograma({ programa }) {
  const objetivo = String(programa?.objetivo ?? '').trim()
  if (!objetivo) return null

  return (
    <section className="rounded-2xl border border-sky-300/90 bg-sky-50/40 p-4 dark:border-sky-800/70 dark:bg-sky-950/20">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800 dark:text-sky-300">
          Objetivo general del programa
        </p>
        <p className="text-xs text-muted-foreground">
          {programa.nombre}
          {programa.anio ? ` · ${programa.anio}` : ''}
        </p>
      </header>

      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{objetivo}</p>

      <p className="mt-3 text-xs text-muted-foreground">
        El objetivo que escribas abajo debe estar alineado con este.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Revisión de alineación con IA
 * ------------------------------------------------------------------ */

const VEREDICTOS = {
  alineado: { etiqueta: 'Alineado', tono: 'success' },
  parcial: { etiqueta: 'Parcialmente alineado', tono: 'warning' },
  desalineado: { etiqueta: 'Desalineado', tono: 'danger' },
}

const CAMPO_REVISADO = { objetivo: 'Objetivo', conclusiones: 'Conclusiones' }

/** Cómo se nombra cada campo dentro de una frase. */
const NOMBRE_CAMPO = { objetivo: 'el objetivo', conclusiones: 'las conclusiones' }

/** Qué contrasta cada botón; va bajo el campo al que pertenece. */
const PIE_REVISION = {
  objetivo: 'Contrasta este objetivo con el objetivo general del programa.',
  conclusiones: 'Contrasta estas conclusiones con el objetivo general del programa.',
}

/**
 * Qué es lo que devuelve la IA en cada campo, que no es lo mismo.
 *
 * En las conclusiones propone un texto listo para pegar. En el objetivo, no:
 * da pautas de lo que le falta para que lo redacte el auditor. Un objetivo es
 * la decisión de qué se va a auditar, y esa la toma quien audita; recibirlo
 * escrito invita a pegarlo sin pensar y a que las veinte auditorías del año
 * acaben con el mismo párrafo.
 */
const TITULO_SUGERENCIA = {
  objetivo: 'Qué le falta para estar alineado',
  conclusiones: 'Redacción propuesta',
}

/**
 * Contrasta un campo del informe con el objetivo general del programa.
 *
 * Hay uno por campo y cada uno va pegado al suyo. Antes era un solo bloque al
 * final que revisaba los dos a la vez; desde que el cierre bajó detrás de los
 * hallazgos, el objetivo y las conclusiones están a pantallas de distancia y
 * ese botón único obligaba a revisar ambos aunque solo se hubiera tocado uno.
 *
 * Revisar el informe entero cuesta ahora dos llamadas en vez de una, y cada una
 * descuenta del tope de revisiones de la auditoría. A cambio, cada llamada
 * lleva un solo texto —el otro campo viaja vacío y el servidor no lo mete en el
 * prompt—, así que sale más corta, y sobre todo se revisa lo que se acaba de
 * escribir en vez de arrastrar el otro campo a medio redactar.
 *
 * Es una segunda lectura, no un semáforo: el informe se guarda igual diga lo
 * que diga. Por eso no condiciona en nada el botón de guardar.
 *
 * Se pide con un botón y no mientras se teclea: cada revisión se paga, y
 * validar en cada pulsación son cientos por informe además de un recuadro
 * parpadeando mientras el auditor intenta pensar.
 *
 * Solo aparece si la auditoría viene de un programa; sin objetivo general no
 * hay nada contra lo que comparar.
 */
function RevisionAlineacion({ campo, informeId, objetivoPrograma, valor }) {
  const [revisando, setRevisando] = useState(false)
  const [resultado, setResultado] = useState(null)
  /** Qué texto exacto se revisó ya, para no pagar dos veces por lo mismo. */
  const [revisado, setRevisado] = useState(null)

  const referencia = String(objetivoPrograma ?? '').trim()
  const escrito = String(valor ?? '').trim()
  const sinCambios = Boolean(resultado) && revisado === escrito

  if (!referencia) return null

  const revisar = async () => {
    try {
      setRevisando(true)
      setResultado(null)

      const data = await validarAlineacion({
        objetivo_programa: referencia,
        objetivo: campo === 'objetivo' ? escrito : '',
        conclusiones: campo === 'conclusiones' ? escrito : '',
        // Con él, el servidor busca en el cronograma los requisitos ISO del
        // proceso. No se mandan desde aquí: son de un programa aprobado.
        informe_id: informeId ?? null,
      })

      setResultado(data)
      setRevisado(escrito)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setRevisando(false)
    }
  }

  return (
    <section
      className={cn('mt-2 rounded-xl p-3 shadow-sm borde-ia', revisando && 'animate-borde-ia')}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-ia shadow-md shadow-fuchsia-500/25">
            {/* Medido sobre el archivo: la marca ocupa 1592 de 3840 px de ancho
                —el 41 %— centrada en un lienzo 16:9 con márgenes transparentes.
                Para que se vea a 19 px en esta caja de 32, la imagen tiene que
                medir 19/0,41 ≈ 46. Va posicionada en absoluto y no centrada con
                el grid porque, al ser más ancha que la caja, el navegador cede a
                alineación «segura» y la empuja a un lado: ese era el descuadre.
                `brightness-0 invert` la pasa a blanco; en negro se perdía. */}
            <Image
              src="/ChatGPT-Logo.png"
              alt=""
              width={128}
              height={72}
              className="absolute left-1/2 top-1/2 w-[2.9rem] max-w-none -translate-x-1/2 -translate-y-1/2 brightness-0 invert"
            />
          </span>

          <p className="text-xs text-muted-foreground">{PIE_REVISION[campo]}</p>
        </div>

        <Button
          type="button"
          size="sm"
          className="border-0 bg-ia text-white shadow-md shadow-fuchsia-500/25 transition hover:brightness-110 disabled:opacity-60 disabled:shadow-none"
          onClick={revisar}
          // Sin cambios no se vuelve a llamar: cada revisión se paga, y pulsar
          // dos veces sobre el mismo texto devuelve lo mismo.
          disabled={revisando || !escrito || sinCambios}
          title={
            !escrito
              ? `Escribe ${NOMBRE_CAMPO[campo]} para poder pedir la revisión`
              : sinCambios
                ? 'Este texto ya está revisado. Cámbialo para volver a revisarlo.'
                : 'Revisar la alineación con el objetivo del programa'
          }
        >
          <Sparkles />
          {revisando ? 'Revisando…' : sinCambios ? 'Ya revisado' : 'Revisar con IA'}
        </Button>
      </div>

      {resultado && (
        <div className="mt-3 space-y-3">
          {resultado.revisiones.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No se obtuvo ninguna observación. Vuelve a intentarlo cuando hayas escrito más.
            </p>
          )}

          {resultado.revisiones.map((revision) => {
            const veredicto = VEREDICTOS[revision.veredicto] ?? VEREDICTOS.parcial

            return (
              <article
                key={revision.campo}
                className="rounded-xl border border-border bg-background p-3"
              >
                <header className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {CAMPO_REVISADO[revision.campo] ?? revision.campo}
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      STATUS_BADGE_TONES[veredicto.tono]
                    )}
                  >
                    {veredicto.etiqueta}
                  </span>
                </header>

                {revision.comentario && (
                  <p className="mt-2 text-sm leading-relaxed">{revision.comentario}</p>
                )}

                {revision.sugerencia && (
                  <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {TITULO_SUGERENCIA[revision.campo] ?? 'Sugerencia'}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                      {revision.sugerencia}
                    </p>
                  </div>
                )}
              </article>
            )
          })}

          {/* El modelo y los tokens se enseñan a propósito: es la señal de que
              la revisión salió de verdad hacia el proveedor, y de lo que costó. */}
          <p className="text-xs text-muted-foreground">
            Es una ayuda, no una calificación: el informe se guarda igual y la redacción final es
            tuya.{' '}
            <span className="tabular-nums opacity-70">
              {resultado.modelo} · {resultado.tokens.entrada + resultado.tokens.salida} tokens
            </span>
          </p>
        </div>
      )}
    </section>
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
  onGuardado,
  embebido = false,
}) {
  const [form, setForm] = useState(FORM_INICIAL)
  const [hallazgos, setHallazgos] = useState(HALLAZGOS_INICIALES)
  const [listaIso, setListaIso] = useState([])
  const [listaCapitulos, setListaCapitulos] = useState({})
  const [listaNumerales, setListaNumerales] = useState({})
  const [loading, setLoading] = useState(false)
  const [ayudaImagen, setAyudaImagen] = useState(null)

  /**
   * Por qué no se pudieron leer los hallazgos guardados, si pasó.
   *
   * Mientras valga algo, el formulario no deja guardar: lo que hay en pantalla
   * no es lo que hay en la base, y guardar reescribe la lista entera.
   */
  const [errorCarga, setErrorCarga] = useState(null)

  /**
   * ¿Ya se confirmó contra la base lo que hay en pantalla?
   *
   * Hasta entonces el guardado automático no se activa: lo primero que se
   * pinta viene de la lista de la vista padre y puede estar atrasado, así que
   * escribirlo reescribiría el informe con valores viejos.
   */
  const [hidratado, setHidratado] = useState(false)

  const router = useRouter()

  /**
   * La auditoría, para leerla dentro del efecto de hidratación sin que su
   * identidad lo dispare. Ver el comentario de ese efecto.
   */
  const auditoriaRef = useRef(auditoria)
  auditoriaRef.current = auditoria

  /**
   * El aviso a la vista de atrás, por referencia: las tres la pasan como
   * función suelta, nueva en cada render, y `persistir` no debe rehacerse por
   * eso.
   */
  const onGuardadoRef = useRef(onGuardado)
  onGuardadoRef.current = onGuardado

  /**
   * Lo escrito, para que `persistir` lea siempre lo último sin recrearse en
   * cada tecla: el guardado automático lo tiene guardado por referencia y una
   * función nueva por pulsación reiniciaría su temporizador.
   */
  const formRef = useRef({ form, hallazgos })
  formRef.current = { form, hallazgos }

  /**
   * Los campos que el auditor ya tocó desde que se abrió el informe.
   *
   * La confirmación contra la base llega unos milisegundos después de que el
   * formulario se abra, y lo que se haya escrito en ese hueco no se pisa: se
   * confirman solo los campos que nadie ha tocado.
   */
  const tocados = useRef(new Set())

  /** Un cambio del auditor. Pasa por aquí para quedar anotado como tocado. */
  const cambiarCampo = useCallback((campo, valor) => {
    tocados.current.add(campo)
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }, [])

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

  /**
   * Trae a la pantalla el informe que ya está guardado. **Una sola vez por
   * auditoría.**
   *
   * La dependencia es el `id` y no el objeto `auditoria`, y eso es lo
   * importante. Las dos vistas de línea de tiempo lo derivan con
   * `auditorias.find(...)` dentro de un `useMemo`, así que es un objeto nuevo
   * cada vez que se refresca la lista —o cada vez que se sube un documento,
   * que la parchea en sitio—. Con el objeto como dependencia, este efecto
   * volvía a correr en medio de la redacción, `setForm` y `setHallazgos`
   * reemplazaban lo escrito por lo que hubiera en la base, y el siguiente
   * guardado lo hacía definitivo. Es lo que vació los hallazgos del informe
   * #352: el auditor había escrito cuatro fortalezas y se guardaron las dos
   * que quedaban en la base.
   *
   * Mientras el `id` no cambie, lo que hay en pantalla manda.
   *
   * Y lo que se pinta al abrir se confirma contra la base antes de dejar que
   * el guardado automático escriba nada, porque esa copia de la lista se queda
   * vieja en cuanto el guardado automático toca el informe.
   */
  useEffect(() => {
    const auditoria = auditoriaRef.current
    if (!auditoria) return

    tocados.current = new Set()
    setHidratado(false)

    // Si el auditor cambia de informe antes de que esta carga termine, su
    // respuesta no se pinta. Sin esto, abrir uno y pasar rápido a otro dejaba
    // los hallazgos del primero en el formulario del segundo, y el siguiente
    // guardado los escribía ahí.
    let vigente = true

    // Se pinta ya con la copia que trae la lista: la pantalla no debe salir en
    // blanco mientras se consulta la base.
    setForm(aFormulario(auditoria))

    const cargarHallazgos = async () => {
      // Y se confirma contra la base, porque la copia de la lista se queda
      // vieja en cuanto el guardado automático escribe. Es lo que devolvía el
      // tipo de asistencia a `null` después de elegir «Físico»: el porqué
      // entero está en `lib/informe-formulario.js`.
      const { data: enLaBase, error: errorInforme } = await supabase
        .from('informes_auditoria')
        .select(COLUMNAS_DEL_FORMULARIO.join(', '))
        .eq('id', auditoria.id)
        .maybeSingle()

      if (!vigente) return

      if (errorInforme) {
        // No se bloquea el guardado: lo que trajo la lista es un punto de
        // partida válido, solo puede estar atrasado. Pero el auditor debe
        // saberlo antes de escribir encima.
        toast.warning(
          `No se pudo confirmar lo que hay guardado del informe (${errorInforme.message}). Lo que ves viene de la lista y puede estar atrasado: recarga la página antes de escribir.`
        )
      } else if (enLaBase) {
        setForm((previo) => mezclarConfirmado(previo, aFormulario(enLaBase), tocados.current))
      }

      const { hallazgos: cargados, error } = await leerHallazgos(
        supabase,
        TIPOS_HALLAZGO,
        auditoria.id
      )

      if (!vigente) return

      // Un fallo de lectura no se pinta como «no hay hallazgos»: se avisa y se
      // bloquea el guardado, porque guardar reescribiría la lista entera con
      // lo poco que se haya podido leer.
      setErrorCarga(error)
      if (error) {
        toast.error(`No se pudieron cargar los hallazgos guardados. ${error}`)
      }

      setHallazgos(cargados)

      // Los catálogos de los hallazgos ya guardados se piden en dos consultas,
      // no una por fila: antes el bucle con `await` disparaba una consulta por
      // hallazgo y la caché en estado aún no se había aplicado, así que las
      // repetía.
      //
      // Si una de las dos falla se avisa. Sin el catálogo, los selectores de
      // norma, capítulo y numeral se pintan vacíos aunque la fila tenga su
      // valor guardado: la tarjeta parece en blanco y no lo está.
      const filas = Object.values(cargados).flat()
      const isos = [...new Set(filas.map((f) => f.iso).filter(Boolean))]
      const capitulos = [...new Set(filas.map((f) => f.capitulo).filter(Boolean))]

      if (isos.length) {
        const { data, error: errorCapitulos } = await supabase
          .from('capitulos')
          .select('*')
          .in('iso_id', isos)
        if (data) setListaCapitulos((prev) => ({ ...prev, ...agruparPor(data, 'iso_id') }))
        if (errorCapitulos) {
          toast.warning(
            'No se pudieron cargar los capítulos de las normas. Los hallazgos guardados conservan su numeral, pero los selectores se verán vacíos: recarga la página antes de tocarlos.'
          )
        }
      }
      if (capitulos.length) {
        const { data, error: errorNumerales } = await supabase
          .from('numerales')
          .select('*')
          .in('capitulo_id', capitulos)
        if (data) setListaNumerales((prev) => ({ ...prev, ...agruparPor(data, 'capitulo_id') }))
        if (errorNumerales) {
          toast.warning(
            'No se pudieron cargar los numerales de las normas. Los hallazgos guardados conservan el suyo, pero los selectores se verán vacíos: recarga la página antes de tocarlos.'
          )
        }
      }
    }

    // Al terminar, no antes: el punto de partida del guardado automático es lo
    // que se acaba de confirmar, no lo que trajo la lista.
    cargarHallazgos()
      .catch((err) => console.error('[informe] no se pudo cargar:', err))
      .finally(() => {
        if (vigente) setHidratado(true)
      })

    return () => {
      vigente = false
    }
  }, [auditoria?.id])

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
    cambiarCampo(name, value)
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

  /**
   * `''` → `null` antes de escribir.
   *
   * Sin campos obligatorios, `fecha_auditoria` y `fecha_seguimiento` pueden
   * quedar vacías, y Postgres rechaza la cadena vacía en una columna `date`. De
   * paso los textos en blanco entran como `null`, que es lo que comprueba el
   * resto del sistema para saber si un apartado está escrito.
   */
  const limpiar = (valor) => (typeof valor === 'string' && !valor.trim() ? null : valor)

  /**
   * Escribe el informe y sus hallazgos. Lo usan el botón y el guardado
   * automático, para que no haya dos caminos que puedan divergir.
   *
   * No avisa ni navega: eso es de quien lo llame. Lanza si algo falla.
   *
   * @returns {Promise<Record<string, number>>} filas escritas por tipo
   */
  const persistir = useCallback(async () => {
    const actual = formRef.current
    const payload = {
      ...Object.fromEntries(Object.entries(actual.form).map(([campo, v]) => [campo, limpiar(v)])),
      auditores_acompanantes: actual.form.auditores_acompanantes
        ? actual.form.auditores_acompanantes.split(',').map((s) => s.trim())
        : [],
    }

    let informeId

    if (auditoriaRef.current) {
      const { error } = await supabase
        .from('informes_auditoria')
        .update(payload)
        .eq('id', auditoriaRef.current.id)
      if (error) throw error
      informeId = auditoriaRef.current.id
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

    // Los hallazgos se sincronizan fila por fila: se inserta lo nuevo, se
    // actualiza lo que ya existe y se borra solo lo que el auditor quitó. Ver
    // `lib/hallazgos-informe.js`.
    const { escritos, ids } = await sincronizarHallazgos(
      supabase,
      TIPOS_HALLAZGO,
      informeId,
      actual.hallazgos
    )

    // Las tarjetas recién insertadas se quedan con el `id` que les dio la
    // base, emparejado por `uid` y no por posición: si el auditor añadió o
    // quitó tarjetas mientras se guardaba, cada una recibe el suyo y el
    // siguiente guardado las actualiza en vez de duplicarlas.
    if (Object.keys(ids).length) {
      setHallazgos((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([clave, lista]) => [
            clave,
            lista.map((h) => (h.id == null && ids[h.uid] ? { ...h, id: ids[h.uid] } : h)),
          ])
        )
      )
    }

    // La lista de la vista de atrás se entera de lo escrito.
    //
    // Sin esto solo se recargaba al pulsar «Guardar informe», así que todo lo
    // que escribía el guardado automático le faltaba: al cerrar el panel
    // —incluso clicando fuera— la línea de tiempo seguía enseñando el informe
    // como estaba al abrirlo, los pasos sin marcar y el tipo de asistencia en
    // blanco. Visto desde la silla del auditor, eso es «no me guardó».
    //
    // Se parchea en sitio y no se vuelve a consultar: son los valores que
    // acaban de escribirse, y una consulta por cada guardado automático sería
    // una recarga de la lista entera cada pocos segundos.
    if (onGuardadoRef.current) {
      onGuardadoRef.current({
        id: informeId,
        ...payload,
        // Las filas que han quedado en la base, para los contadores de
        // hallazgos: solo las tarjetas vivas entran en `ids`, las vacías no.
        ...Object.fromEntries(
          TIPOS_HALLAZGO.map((tipo) => [
            tipo.tabla,
            (actual.hallazgos[tipo.key] ?? [])
              .map((h) => ids[h.uid])
              .filter((id) => id != null)
              .map((id) => ({ id })),
          ])
        ),
      })
    }

    return escritos
  }, [usuario])

  /**
   * Guardado automático mientras escribe.
   *
   * Solo sobre un informe que ya existe: en uno nuevo, cada tecla crearía una
   * fila. Y nunca si la carga de hallazgos falló, porque entonces la pantalla
   * no refleja la base y escribirla la estropearía.
   *
   * La firma retrata **solo el contenido**: ni `uid` ni `id`. Esos los asigna
   * el propio guardado, y si contaran, cada guardado cambiaría la firma y
   * pediría otro guardado detrás, en bucle.
   */
  const firma = useMemo(
    () =>
      JSON.stringify({
        form,
        hallazgos: TIPOS_HALLAZGO.map((tipo) =>
          (hallazgos[tipo.key] ?? []).map((h) => [
            h.iso,
            h.capitulo,
            h.numeral,
            ...tipo.campos.map((c) => h[c.name]),
          ])
        ),
      }),
    [form, hallazgos]
  )

  const autoguardado = useGuardadoAutomatico({
    activo: Boolean(auditoria) && !errorCarga && hidratado,
    firma,
    guardar: persistir,
  })

  // Suelta y no `autoguardado.guardarYa`: como dependencia de un efecto, esa
  // forma hace que la regla de dependencias pida el objeto entero, que es
  // nuevo en cada render.
  const { guardarYa } = autoguardado

  // Si el auditor escribió mientras se confirmaba el informe, eso no está
  // guardado y el guardado automático acaba de tomar la pantalla como punto de
  // partida, así que por sí solo no lo escribiría nunca. Se fuerza una vez.
  useEffect(() => {
    if (!hidratado || !tocados.current.size) return
    guardarYa().catch(() => {})
  }, [hidratado, guardarYa])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    // Si los hallazgos guardados no se pudieron leer, la pantalla no refleja
    // la base y guardar los reescribiría con lo que haya cargado: es
    // exactamente la forma de perderlos.
    if (errorCarga) {
      toast.error(
        'No se guarda: los hallazgos guardados no se pudieron leer, y guardar ahora los reemplazaría. Recarga la página y vuelve a abrir el informe.'
      )
      return
    }

    setLoading(true)

    try {
      // Por la cola del automático, no llamando a `persistir` a pelo. Si hay
      // un guardado en vuelo, este espera a que acabe en vez de escribir a la
      // vez: dos `sincronizarHallazgos` simultáneos veían la misma tarjeta
      // todavía sin `id` y la insertaban dos veces. En el informe #354
      // quedaron las fortalezas 2522 y 2523, idénticas, con 139 ms entre una
      // y otra. Además deja la firma marcada, así que al cerrar el formulario
      // no sale un guardado gemelo detrás de este.
      const escritos = await guardarYa()

      // El aviso dice qué se escribió, con los ceros incluidos. Antes decía
      // «guardados correctamente» pasara lo que pasara, así que un guardado
      // que no insertó ni una fila se veía idéntico a uno completo: es lo que
      // hizo que la pérdida de hallazgos del informe #352 tardara días en
      // notarse.
      toast.success(
        `Informe guardado · ${resumenEscrito(TIPOS_HALLAZGO, escritos)}`
      )

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
    // De la cadena y no de un `Date`: `new Date('2026-01-01')` es medianoche
    // UTC y leída en Bogotá cae en 2025 (ver `lib/fechas`).
    return anioDe(auditoria.fecha_auditoria)
  }, [auditoria])

  const totalHallazgos = TIPOS_HALLAZGO.reduce((n, t) => n + hallazgos[t.key].length, 0)

  /** Cuántos campos hay escritos ya, para las barras de avance. */
  const camposCompletos = CAMPOS_DEL_AVANCE.filter((campo) =>
    String(form[campo] || '').trim()
  ).length
  const encuadreCompleto = CAMPOS_ENCUADRE.filter((c) => String(form[c.name] || '').trim()).length
  const cierreCompleto = CAMPOS_CIERRE.filter((c) => String(form[c.name] || '').trim()).length
  const progreso = Math.round((camposCompletos / CAMPOS_DEL_AVANCE.length) * 100)
  const faltan = CAMPOS_DEL_AVANCE.length - camposCompletos

  /**
   * Los acompañantes vienen propuestos por el cronograma del programa.
   *
   * Se enseña de dónde salen, pero **el campo se puede escribir**. El
   * cronograma dice quién iba a acompañar; el informe cuenta quién acompañó de
   * verdad, y las dos cosas se separan a menudo: alguien se enferma, entra
   * otro auditor, va uno más. Bloqueado, el auditor no tenía forma de dejar
   * constancia de lo que pasó y el informe quedaba contando el plan en vez de
   * la auditoría.
   *
   * Que el informe y el cronograma puedan discrepar es el precio, y es el
   * precio correcto: el informe es el registro de lo ocurrido.
   *
   * Se mira `auditoria` y no `form` a propósito: el estado del formulario se
   * puede vaciar y entonces la nota del programa desaparecería.
   */
  const acompanantesDelPrograma =
    Boolean(auditoria?.programa?.id) && (auditoria?.auditores_acompanantes?.length ?? 0) > 0

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

  /**
   * Los apartados de texto largo.
   *
   * Se renderizan igual arriba (encuadre) y abajo (cierre); lo único que
   * cambia es qué lista se le pasa.
   */
  const camposDeTexto = (campos) => (
    <div className="grid gap-4">
      {campos.map((campo) => (
        <Field key={campo.name} label={campo.label} htmlFor={campo.name}>
          <AutoTextarea
            id={campo.name}
            name={campo.name}
            value={form[campo.name]}
            onChange={handleChange}
            placeholder={campo.placeholder}
            className="min-h-[88px] bg-background"
          />

          {/* Debajo del campo que revisa y no al final del formulario: el
              objetivo y las conclusiones viven ahora en secciones distintas. */}
          {campo.revisable && (
            <RevisionAlineacion
              campo={campo.name}
              informeId={auditoria?.id}
              objetivoPrograma={auditoria?.programa?.objetivo}
              valor={form[campo.name]}
            />
          )}
        </Field>
      ))}
    </div>
  )

  return (
    <div className={embebido ? 'flex flex-col gap-4' : PAGE_SHELL}>
      {/* En un drawer la cabecera la pone el propio panel. */}
      {!embebido && (
        <PageHeader
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
            <Field label="Fecha de la auditoría" htmlFor="fecha_auditoria">
              <DatePicker
                id="fecha_auditoria"
                value={form.fecha_auditoria}
                onChange={(v) => cambiarCampo('fecha_auditoria', v)}
              />
            </Field>

            <Field label="Asistencia" htmlFor="asistencia_tipo">
              <Select
                value={form.asistencia_tipo}
                onValueChange={(v) => cambiarCampo('asistencia_tipo', v)}
              >
                <SelectTrigger id="asistencia_tipo">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ASISTENCIA_TIPOS.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}

                  {/* Un valor guardado que no esté en la lista se añade como
                      opción para que se vea. Sin esto el campo aparece vacío y
                      el auditor no tiene forma de saber qué había. */}
                  {form.asistencia_tipo && !esAsistenciaConocida(form.asistencia_tipo) && (
                    <SelectItem value={form.asistencia_tipo}>
                      {form.asistencia_tipo} (como está guardado)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>
        </FormSection>

        <FormSection
          tone="optional"
          title="Acompañamiento"
          description={
            acompanantesDelPrograma
              ? 'Vienen del cronograma del programa. Ajústalos si al final acompañó otra persona.'
              : 'Puedes dejarlo en blanco si auditaste en solitario.'
          }
        >
          <FieldGrid>
            <Field
              label="Auditores acompañantes"
              htmlFor="auditores_acompanantes"
              help="Separa cada nombre con una coma."
              // La nota dice de dónde vienen los nombres, no que estén
              // cerrados: sin candado y sin campo apagado, que es lo que hacía
              // pensar que no se podían tocar.
              action={
                acompanantesDelPrograma && (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Según {auditoria?.programa?.nombre || 'el programa'}
                  </span>
                )
              }
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

        {/* ── Encuadre: lo que se define antes de auditar ── */}
        <FormSection
          title="Objetivo y criterios"
          description="Para qué se auditó y contra qué se contrastó."
          actions={
            <>
              <span className="text-[11px] text-muted-foreground">✓ Corrector ortográfico</span>
              <Avance hechos={encuadreCompleto} total={CAMPOS_ENCUADRE.length} />
            </>
          }
        >
          {/* Antes de los campos, porque «objetivo» es el primero de la lista. */}
          <ObjetivoDelPrograma programa={auditoria?.programa} />

          {camposDeTexto(CAMPOS_ENCUADRE)}
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
          {totalHallazgos === 0 && (
            <p className="rounded-xl border border-dashed border-border bg-background/60 px-4 py-6 text-center text-xs text-muted-foreground">
              Todavía no has registrado hallazgos. Añade una fortaleza, una oportunidad de mejora o
              una no conformidad con los botones de abajo.
            </p>
          )}

          {/* Un bloque por tipo, y su botón al final del bloque: al añadir uno,
              el siguiente botón queda justo debajo de lo que acabas de crear. */}
          {TIPOS_HALLAZGO.map((tipo) => (
            <section key={tipo.key} className="space-y-3">
              {hallazgos[tipo.key].map((hallazgo, i) => (
                <article
                  // Por `uid` y no por posición: al borrar una tarjeta del
                  // medio, con la posición React reutilizaba el nodo y el
                  // texto de la siguiente aparecía en la caja anterior.
                  key={hallazgo.uid ?? `${tipo.key}-${i}`}
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
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => agregarHallazgo(tipo)}
                className={cn(
                  'h-auto w-full justify-start gap-2 bg-background py-2.5 text-sm',
                  tipo.boton
                )}
              >
                <Plus />
                <span className="font-semibold">
                  Añadir {tipo.singular.toLowerCase()}
                </span>
                <span className="ml-auto text-xs tabular-nums opacity-70">
                  {hallazgos[tipo.key].length}
                </span>
              </Button>
            </section>
          ))}
        </FormSection>

        {/* ── Cierre: lo que se escribe cuando ya hay hallazgos ── */}
        <FormSection
          title="Conclusiones y cierre"
          description="Va al final a propósito: se redacta con los hallazgos ya delante."
          actions={
            <>
              <span className="text-[11px] text-muted-foreground">✓ Corrector ortográfico</span>
              <Avance hechos={cierreCompleto} total={CAMPOS_CIERRE.length} />
            </>
          }
        >
          {camposDeTexto(CAMPOS_CIERRE)}

          <FieldGrid>
            <Field
              label="Fecha de seguimiento"
              htmlFor="fecha_seguimiento"
              help="Resolución 290 de 2019 de la Universidad del Cauca."
            >
              <DatePicker
                id="fecha_seguimiento"
                value={form.fecha_seguimiento}
                onChange={(v) => cambiarCampo('fecha_seguimiento', v)}
              />
            </Field>
          </FieldGrid>
        </FormSection>

        {/* El guardado ya no se anuncia en la pantalla: ocurre sin decir
            nada. Un fallo sí se dice, y entero y fijo —un aviso que se
            desvanece no sirve—, porque es lo único que separa «tu trabajo
            está a salvo» de «no lo está». Sin mencionar que es automático:
            lo que el auditor necesita es saber qué hacer. */}
        {autoguardado.estado === 'error' && autoguardado.error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <strong className="font-semibold">No se pudo guardar.</strong>{' '}
            {autoguardado.error}
            <span className="mt-1 block text-xs">
              Lo que has escrito sigue en pantalla. Pulsa «Guardar informe» para intentarlo otra
              vez.
            </span>
          </p>
        )}

        {/* Si los hallazgos guardados no se pudieron leer, se dice aquí y no
            solo en un aviso que se desvanece: guardar en ese estado los
            reemplazaría por lo que haya en pantalla. */}
        {errorCarga && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            No se pudieron cargar los hallazgos ya guardados de esta auditoría ({errorCarga}). El
            guardado está bloqueado para no reemplazarlos: recarga la página y vuelve a abrir el
            informe.
          </p>
        )}

        {/* Guardar siempre a la vista: el formulario es largo. */}
        <StickyBar
          info={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                  ? 'Informe completo'
                  : `${faltan} campo${faltan === 1 ? '' : 's'} sin escribir · puedes guardar igual`}
              </span>
            </span>
          }
        >
          {onVolver && (
            <Button type="button" variant="outline" onClick={onVolver} disabled={loading}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading || Boolean(errorCarga)}>
            <Save />
            {loading ? 'Guardando…' : 'Guardar informe'}
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
