'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, readStoredTheme, storeTheme, THEMES } from '@/lib/theme'
import { cn } from '@/lib/utils'

/**
 * Botón flotante para alternar claro / oscuro.
 *
 * Va montado una sola vez en el layout raíz, así que aparece en todas las
 * pantallas. El tema real ya lo aplicó el script del <head> antes del primer
 * pintado; aquí solo sincronizamos el estado y respondemos al clic.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(THEMES.LIGHT)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    setTheme(readStoredTheme())
    setMontado(true)
  }, [])

  const alternar = () => {
    const siguiente = theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK
    setTheme(siguiente)
    applyTheme(siguiente)
    storeTheme(siguiente)
  }

  const esOscuro = theme === THEMES.DARK
  const etiqueta = esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={esOscuro}
      className={cn(
        'fixed bottom-6 right-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full',
        'border border-border bg-card text-foreground shadow-lg',
        'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'cursor-pointer print:hidden',
        // Hasta que monta no sabemos el tema real: lo dejamos neutro para que
        // no parpadee el icono equivocado.
        !montado && 'opacity-0'
      )}
    >
      {esOscuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
