'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Rocket, XCircle } from 'lucide-react'

import { migrarUsuariosAAuth } from '@/features/auth/api/auth-api'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { PAGE_SHELL, SECTION_CARD } from '@/components/ui/tokens'
import { cn } from '@/lib/utils'

const ADVERTENCIAS = [
  'Migra TODOS los usuarios de la tabla `usuarios` a Supabase Auth.',
  'Los IDs de los usuarios pasan a ser UUID de Supabase.',
  'Las contraseñas actuales se conservan: la migración es gradual y transparente.',
  'En el primer login, la contraseña se migra sola a Supabase Auth.',
  'No se envía ningún correo.',
  'La operación no se deshace fácilmente.',
]

const PRERREQUISITOS = [
  'Tener `SUPABASE_SERVICE_ROLE_KEY` configurada en el entorno.',
  'Haber hecho copia de seguridad de la base de datos.',
  'Verificar que el correo de Supabase funciona.',
]

const SIGUIENTES_PASOS = [
  'Los usuarios siguen usando sus contraseñas actuales; no hace falta avisarles.',
  'Verifica que puedan iniciar sesión correctamente.',
  'En el primer login su contraseña se migra automáticamente.',
  'Cuando todos hayan entrado al menos una vez, puedes retirar la columna `password` (ver docs/MIGRACION-PASSWORDS.md).',
]

/** Lista de detalle plegable dentro del resultado. */
function ListaDetalle({ titulo, items, render, tono }) {
  if (!items?.length) return null

  return (
    <div className={cn('rounded-lg border p-3', tono)}>
      <h4 className="mb-2 text-sm font-semibold">{titulo}</h4>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
        {items.map((item, i) => (
          <li key={i}>{render(item)}</li>
        ))}
      </ul>
    </div>
  )
}

export default function MigrateContent() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  const handleMigrate = async () => {
    if (
      !confirm(
        '¿Ejecutar la migración? Creará usuarios en Supabase Auth y actualizará los IDs.'
      )
    ) {
      return
    }

    setLoading(true)
    setError(null)
    setResultado(null)

    try {
      setResultado(await migrarUsuariosAAuth())
    } catch (err) {
      setError(err?.message || 'Error en la migración')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn(PAGE_SHELL, 'mx-auto min-h-screen max-w-5xl bg-app p-5 sm:p-6 lg:p-8')}>
      <PageHeader
        icon="🔐"
        title="Migración de usuarios a Supabase Auth"
        subtitle="Operación puntual. Léela entera antes de ejecutarla."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className={cn(SECTION_CARD, 'border-amber-300 bg-amber-50 p-5')}>
          <header className="mb-3 flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="text-sm font-semibold">Importante, lee antes de continuar</h3>
          </header>
          <ul className="ml-5 list-disc space-y-1.5 text-sm text-amber-900/90">
            {ADVERTENCIAS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </article>

        <article className={cn(SECTION_CARD, 'p-5')}>
          <header className="mb-3 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">Prerrequisitos</h3>
          </header>
          <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
            {PRERREQUISITOS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </article>
      </div>

      <Button onClick={handleMigrate} disabled={loading} size="lg" className="self-start">
        <Rocket />
        {loading ? 'Migrando usuarios…' : 'Ejecutar migración'}
      </Button>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {resultado && (
        <section className="flex flex-col gap-4">
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Migración completada.
          </p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon="👥" tone="blue" label="Procesados" value={resultado.resumen.total} />
            <StatCard icon="✅" tone="green" label="Migrados" value={resultado.resumen.exitosos} />
            <StatCard icon="↩️" tone="gray" label="Omitidos" value={resultado.resumen.omitidos} />
            <StatCard icon="⚠️" tone="orange" label="Errores" value={resultado.resumen.errores} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ListaDetalle
              titulo="Migrados"
              items={resultado.resultados.exitosos}
              tono="border-emerald-200 bg-emerald-50 text-emerald-900"
              render={(u) => (
                <>
                  {u.email}{' '}
                  <span className="opacity-70">
                    ({u.oldId} → {u.newId})
                  </span>
                </>
              )}
            />
            <ListaDetalle
              titulo="Con errores"
              items={resultado.resultados.errores}
              tono="border-red-200 bg-red-50 text-red-900"
              render={(e) => (
                <>
                  {e.email}: <em>{e.error}</em>
                </>
              )}
            />
            <ListaDetalle
              titulo="Omitidos"
              items={resultado.resultados.omitidos}
              tono="border-border bg-muted/50 text-muted-foreground"
              render={(o) => (
                <>
                  {o.email}: <em>{o.razon}</em>
                </>
              )}
            />
          </div>

          <article className={cn(SECTION_CARD, 'p-5')}>
            <h4 className="mb-3 text-sm font-semibold">Próximos pasos</h4>
            <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground">
              {SIGUIENTES_PASOS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </article>
        </section>
      )}
    </div>
  )
}
