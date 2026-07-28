'use client'

/**
 * Panel lateral (drawer) sobre `vaul`.
 *
 * Es el patrón de SoluGRH: entra desde la derecha, ocupa toda la altura y deja
 * ver el listado detrás. Para formularios largos funciona mejor que un diálogo
 * centrado, porque el contenido puede desplazarse sin mover la cabecera ni los
 * botones.
 */
import * as React from 'react'
import { X } from 'lucide-react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { cn } from '@/lib/utils'

/**
 * `shouldScaleBackground` solo hace algo si existe un elemento con
 * `[data-vaul-drawer-wrapper]` alrededor de la app; aquí no lo hay, así que se
 * deja apagado en vez de encender un efecto que no se ve.
 */
const Drawer = ({ shouldScaleBackground = false, ...props }) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
)
Drawer.displayName = 'Drawer'

const DrawerTrigger = DrawerPrimitive.Trigger
const DrawerPortal = DrawerPrimitive.Portal
const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef(function DrawerOverlay({ className, ...props }, ref) {
  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/60',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
})

const DrawerContent = React.forwardRef(function DrawerContent(
  { className, children, ...props },
  ref
) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          'fixed inset-y-0 right-0 z-[9999] flex h-full w-full flex-col',
          'max-w-[min(1040px,calc(100vw-1rem))] sm:max-w-[min(1040px,calc(100vw-2rem))]',
          'border-l border-border bg-background shadow-2xl duration-200 sm:rounded-l-2xl',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className
        )}
        {...props}
      >
        {children}

        <DrawerPrimitive.Close className="absolute right-4 top-4 cursor-pointer rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DrawerPrimitive.Close>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
})

/** Cabecera fija; `pr-14` deja hueco a la X. */
const DrawerHeader = ({ className, ...props }) => (
  <div
    className={cn('flex flex-col space-y-1.5 border-b border-border px-6 py-5 pr-14', className)}
    {...props}
  />
)
DrawerHeader.displayName = 'DrawerHeader'

/**
 * Zona desplazable entre cabecera y pie.
 *
 * `select-text` deshace el `user-select: none` que `vaul` aplica a todo el
 * drawer en escritorio (`[data-vaul-drawer]`, dentro de una media query
 * `hover:hover`). Ese estilo existe para que arrastrar el panel no seleccione
 * texto, pero de paso **apaga el corrector ortográfico**: Chrome no dibuja los
 * subrayados dentro de un elemento que no se puede seleccionar. En un panel de
 * formulario interesa más poder escribir y corregir que arrastrar.
 */
const DrawerBody = ({ className, ...props }) => (
  <div className={cn('flex-1 select-text overflow-y-auto px-6 py-5', className)} {...props} />
)
DrawerBody.displayName = 'DrawerBody'

/** Pie fijo con las acciones. */
const DrawerFooter = ({ className, ...props }) => (
  <div
    className={cn(
      'mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4',
      className
    )}
    {...props}
  />
)
DrawerFooter.displayName = 'DrawerFooter'

const DrawerTitle = React.forwardRef(function DrawerTitle({ className, ...props }, ref) {
  return (
    <DrawerPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
})

const DrawerDescription = React.forwardRef(function DrawerDescription({ className, ...props }, ref) {
  return (
    <DrawerPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
})

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
