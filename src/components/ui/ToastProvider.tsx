'use client'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { Z_TOAST } from '@/components/ui/tokens'

/**
 * Los avisos van por encima de todo; el orden de capas está en `tokens.js`.
 *
 * Va en `style` y no como clase ni como variable CSS porque la hoja de
 * `react-toastify` se carga después de `globals.css` y volvería a pisar el
 * valor: trae `z-index: 9999`, el mismo que el panel lateral, y como el panel
 * se porta al final del `body` ganaba por orden del DOM. Resultado: los errores
 * de validación de un formulario abierto en un panel se emitían y nadie los veía.
 */
export default function ToastProvider() {
  return <ToastContainer position="top-right" autoClose={3000} style={{ zIndex: Z_TOAST }} />
}
