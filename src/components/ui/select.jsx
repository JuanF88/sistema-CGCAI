'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z_POPOVER } from '@/components/ui/tokens'

/**
 * La raíz de Radix, con una sola diferencia: **nunca avisa de un valor vacío**.
 *
 * Dentro de un `<form>`, Radix monta un `<select>` nativo oculto para que el
 * valor viaje con el formulario, y cada vez que el valor cambia lo copia ahí y
 * dispara un `change`. Las `<option>` de ese nativo se registran unos renders
 * después de montar, así que si el valor cambia en ese hueco —un formulario
 * que se rellena en un efecto, como el del informe— el nativo no tiene la
 * opción, se queda en blanco y Radix lo toma por una elección:
 * `onValueChange('')`.
 *
 * Es lo que borraba el tipo de asistencia: un informe guardado como «Físico»
 * se abría con «Selecciona el tipo», el campo quedaba como tocado y el
 * guardado automático escribía `null` en la base. «Digital» se salvaba solo
 * porque es el valor con el que arranca el formulario, y sin cambio no hay
 * `change`.
 *
 * Lo mismo pasa al vaciar un selector pasándole `undefined`, como hace
 * `SelectCatalogo` al cambiar la norma de un hallazgo: el `''` llegaba como
 * `Number('')`, el capítulo quedaba en `0` y el guardado intentaba escribirlo
 * como `capitulo_id`.
 *
 * Filtrarlo aquí es seguro: Radix no admite una opción con valor `''` —lanza
 * un error—, así que ninguna elección real puede llegar vacía. Las vistas que
 * necesitan «ninguno» ya usan un centinela (`'todos'`, `'sin-definir'`).
 */
function Select({ onValueChange, ...props }) {
  return (
    <SelectPrimitive.Root
      {...props}
      onValueChange={
        onValueChange &&
        ((valor) => {
          if (valor !== '') onValueChange(valor)
        })
      }
    />
  )
}
Select.displayName = 'Select'

const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(function SelectTrigger(
  { className, children, ...props },
  ref
) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
        'placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        '[&>span]:line-clamp-1 [&>span]:text-left cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})

const SelectScrollUpButton = React.forwardRef(function SelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  )
})

const SelectScrollDownButton = React.forwardRef(function SelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      className={cn('flex cursor-default items-center justify-center py-1', className)}
      {...props}
    >
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  )
})

/**
 * La lista se porta al `<body>`, así que necesita la capa de desplegable: con
 * `z-50` se abría **detrás** de los paneles laterales y parecía que el
 * desplegable no respondía al pulsarlo.
 */
const SelectContent = React.forwardRef(function SelectContent(
  { className, children, position = 'popper', ...props },
  ref
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          'relative max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
          Z_POPOVER,
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})

const SelectLabel = React.forwardRef(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}
      {...props}
    />
  )
})

const SelectItem = React.forwardRef(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})

const SelectSeparator = React.forwardRef(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
})

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
