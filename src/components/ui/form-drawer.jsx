'use client'

/**
 * Formulario dentro de un panel lateral.
 *
 * Junta el `Drawer` con la estructura que siempre se repite —cabecera fija,
 * cuerpo desplazable y pie con Cancelar/Guardar—, de modo que una pantalla solo
 * tenga que poner sus campos dentro.
 *
 *   <FormDrawer
 *     open={abierto}
 *     onOpenChange={setAbierto}
 *     title="Nuevo candidato"
 *     description="Completa la información inicial."
 *     onSubmit={guardar}
 *     submitting={guardando}
 *     submitLabel="Crear candidato"
 *   >
 *     <FormSection title="Campos obligatorios">…</FormSection>
 *   </FormDrawer>
 */
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.headerExtra]  Bajo la descripción (chips, avisos)
 * @param {(e: React.FormEvent) => void} [props.onSubmit]
 * @param {boolean} [props.submitting]
 * @param {string}  [props.submitLabel]
 * @param {React.ReactNode} [props.footerInfo]   A la izquierda del pie
 * @param {React.ReactNode} [props.footerExtra]  Botones extra antes de Guardar
 * @param {boolean} [props.hideFooter]           Si el formulario trae su propio pie
 */
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  onSubmit,
  submitting = false,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  footerInfo,
  footerExtra,
  hideFooter = false,
  children,
  className,
}) {
  const contenido = (
    <>
      <DrawerHeader>
        <DrawerTitle>{title}</DrawerTitle>
        {description ? (
          <DrawerDescription>{description}</DrawerDescription>
        ) : (
          // Radix avisa por consola si falta la descripción del diálogo.
          <DrawerDescription className="sr-only">{title}</DrawerDescription>
        )}
        {headerExtra}
      </DrawerHeader>

      <DrawerBody className="space-y-4">{children}</DrawerBody>

      {!hideFooter && (
        <DrawerFooter className={cn(footerInfo && 'justify-between')}>
          {footerInfo && (
            <div className="min-w-0 text-sm text-muted-foreground">{footerInfo}</div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {cancelLabel}
            </Button>
            {footerExtra}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : submitLabel}
            </Button>
          </div>
        </DrawerFooter>
      )}
    </>
  )

  return (
    <Drawer open={open} direction="right" onOpenChange={onOpenChange}>
      <DrawerContent className={cn('overflow-hidden p-0', className)}>
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            {contenido}
          </form>
        ) : (
          contenido
        )}
      </DrawerContent>
    </Drawer>
  )
}
