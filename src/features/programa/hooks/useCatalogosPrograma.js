'use client'

/**
 * Opciones de los desplegables de la hoja «Distribución».
 *
 * Traduce lo que devuelve `/api/programa-auditoria/catalogos` a listas listas
 * para el `Combobox`, cada una con lo que hace falta para autocompletar los
 * campos vecinos al elegir (correo, estudios, gestión…).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

import { obtenerCatalogosPrograma } from '@/features/programa/api/programa-api'

/** Títulos habituales, por si la base todavía no tiene ninguno. */
const TITULOS_BASE = ['Doctor', 'Doctora', 'Magíster', 'Especialista', 'Profesional']

const VACIO = { dependencias: [], usuarios: [], sugerencias: {}, normas: [] }

/** Sin tildes ni mayúsculas, para comparar nombres escritos de otra forma. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Une listas de textos, quita duplicados y ordena. */
const unir = (...listas) => {
  const vistos = new Map()

  for (const valor of listas.flat()) {
    const texto = String(valor ?? '').trim()
    if (texto && !vistos.has(texto.toLowerCase())) vistos.set(texto.toLowerCase(), texto)
  }

  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Textos sueltos → opciones del `Combobox`. */
const comoOpciones = (valores) => valores.map((value) => ({ value }))

/**
 * Numerales de la norma cuyo nombre contiene `codigo` («9001», «14001»).
 *
 * Se busca por subcadena y no por igualdad porque en la tabla `iso` el nombre
 * viene escrito de varias formas («ISO 9001:2015», «NTC ISO 9001»).
 */
const numeralesDe = (normas, codigo) => {
  const norma = normas.find((n) => String(n.norma ?? '').includes(codigo))

  return (norma?.numerales ?? []).map((n) => ({
    value: n.numeral,
    label: n.numeral,
    description: n.capitulo,
  }))
}

export function useCatalogosPrograma(activo = true) {
  const [datos, setDatos] = useState(VACIO)
  const [cargando, setCargando] = useState(false)

  /**
   * Contador que fuerza a volver a pedir los catálogos.
   *
   * Hace falta porque desde el cronograma se pueden crear dependencias y
   * auditores sin cerrar el panel: recién creados no estarían en las listas y
   * el desplegable seguiría sin ofrecerlos hasta la siguiente apertura.
   */
  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  useEffect(() => {
    if (!activo) return

    let vigente = true
    setCargando(true)

    obtenerCatalogosPrograma()
      .then((res) => vigente && setDatos({ ...VACIO, ...res }))
      // Sin catálogos los campos siguen siendo escribibles: no se molesta al
      // usuario con un error por perder unas sugerencias.
      .catch((error) => console.error('[catálogos del programa]', error.message))
      .finally(() => vigente && setCargando(false))

    return () => {
      vigente = false
    }
  }, [activo, recarga])

  const opciones = useMemo(() => {
    const { dependencias, usuarios, sugerencias, normas } = datos

    /** Personas: el nombre se escribe, el resto viaja en `datos`. */
    const personas = usuarios.map((u) => ({
      value: u.nombreCompleto,
      label: u.nombreCompleto,
      description: [u.email, u.tipo_personal].filter(Boolean).join(' · '),
      datos: u,
    }))

    const auditores = personas.filter((p) => p.datos.rol === 'auditor')

    const correos = usuarios
      .filter((u) => u.email)
      .map((u) => ({ value: u.email, label: u.email, description: u.nombreCompleto, datos: u }))

    return {
      // Los auditores primero, pero sin esconder al resto del personal.
      auditores: [...auditores, ...personas.filter((p) => p.datos.rol !== 'auditor')],
      personas,
      correos,

      dependencias: dependencias.map((d) => ({
        value: d.nombre,
        label: d.nombre,
        description: d.gestion,
        datos: d,
      })),

      gestiones: comoOpciones(
        unir(
          dependencias.map((d) => d.gestion),
          sugerencias.gestion
        )
      ),

      organismos: comoOpciones(
        unir(
          dependencias.map((d) => d.nombre),
          sugerencias.organismo
        )
      ),

      facultades: comoOpciones(unir(sugerencias.facultad)),
      decanaturas: comoOpciones(unir(sugerencias.decanatura_nombre)),

      titulos: comoOpciones(
        unir(
          TITULOS_BASE,
          usuarios.map((u) => u.tipo_estudio),
          sugerencias.responsable_titulo,
          sugerencias.coordinador_nivel,
          sugerencias.decano_titulo
        )
      ),

      estudios: comoOpciones(
        unir(
          usuarios.map((u) => u.estudios),
          sugerencias.auditor_estudios
        )
      ),

      // Cronograma: procesos y requisitos de cada norma.
      procesos: comoOpciones(
        unir(
          dependencias.map((d) => d.nombre),
          sugerencias.proceso
        )
      ),
      requisitos9001: numeralesDe(normas, '9001'),
      requisitos14001: numeralesDe(normas, '14001'),
    }
  }, [datos])

  /**
   * Lo que se puede deducir de una dependencia elegida.
   *
   * El único vínculo entre una persona y una dependencia es
   * `usuarios.dependencia_id`, así que de ahí sale el gestor de calidad (el
   * usuario con rol `gestor`). Coordinador, decanatura y decano no existen
   * como dato en el sistema y se devuelven vacíos.
   */
  const derivarDeDependencia = useMemo(() => {
    const porNombre = new Map(datos.dependencias.map((d) => [normalizar(d.nombre), d]))

    const personalPor = new Map()
    for (const u of datos.usuarios) {
      if (!u.dependencia_id) continue
      if (!personalPor.has(u.dependencia_id)) personalPor.set(u.dependencia_id, [])
      personalPor.get(u.dependencia_id).push(u)
    }

    return (nombre) => {
      const dep = porNombre.get(normalizar(nombre))
      if (!dep) return { proceso: nombre }

      const personal = personalPor.get(dep.dependencia_id) ?? []
      const gestor = personal.find((u) => u.rol === 'gestor')

      return {
        proceso: dep.nombre,
        gestion: dep.gestion ?? '',
        organismo: dep.nombre,
        gestor_nombre: gestor?.nombreCompleto ?? '',
        gestor_correo: gestor?.email ?? '',
      }
    }
  }, [datos])

  /**
   * Las dependencias de un proceso del mapa, para su sección del cronograma.
   *
   * Se filtra por `dependencias.gestion`, que es la clave del proceso. Si un
   * proceso no tiene ninguna dependencia clasificada se devuelven todas: es
   * mejor poder elegir que quedarse con un desplegable vacío por un dato de
   * catálogo sin rellenar.
   */
  const dependenciasDeProceso = useMemo(() => {
    const porClave = new Map()

    for (const opcion of opciones.dependencias) {
      const clave = opcion.datos?.gestion || 'otras'
      if (!porClave.has(clave)) porClave.set(clave, [])
      porClave.get(clave).push(opcion)
    }

    return (clave) => {
      const propias = porClave.get(clave) ?? []
      return propias.length ? propias : opciones.dependencias
    }
  }, [opciones])

  /** Una persona del catálogo por su nombre, tolerando tildes y mayúsculas. */
  const personaPorNombre = useMemo(() => {
    const porNombre = new Map(datos.usuarios.map((u) => [normalizar(u.nombreCompleto), u]))
    return (nombre) => porNombre.get(normalizar(nombre))
  }, [datos])

  return {
    opciones,
    cargando,
    recargar,
    derivarDeDependencia,
    dependenciasDeProceso,
    personaPorNombre,
  }
}
