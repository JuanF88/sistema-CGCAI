'use client'

/**
 * Modal reutilizable para subir documentos (PDF por defecto).
 *
 * Pensado para reemplazar los modales de subida duplicados del timeline
 * (plan, asistencia, evaluación, acta, acta de compromiso, validación).
 */
import { useState } from 'react'
import { CheckCircle2, ExternalLink, Paperclip } from 'lucide-react'
import { toast } from 'react-toastify'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.currentFileUrl]  Archivo ya cargado, si lo hay
 * @param {(file: File) => Promise<void>} props.onUpload
 * @param {boolean} [props.isUploading]
 * @param {number} [props.maxSizeMB]
 * @param {string} [props.acceptedTypes]   MIME aceptado
 * @param {string} [props.viewCurrentLabel]
 * @param {string} [props.uploadButtonLabel]
 */
export default function DocumentUploadModal({
  isOpen,
  onClose,
  title,
  description,
  currentFileUrl = null,
  onUpload,
  isUploading = false,
  maxSizeMB = 2,
  acceptedTypes = 'application/pdf',
  viewCurrentLabel = 'Ver archivo actual',
  uploadButtonLabel = 'Subir',
}) {
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null

    if (file && file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`El archivo supera el tamaño máximo de ${maxSizeMB} MB.`)
      e.target.value = ''
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    await onUpload(selectedFile)
    setSelectedFile(null)
  }

  const handleClose = () => {
    setSelectedFile(null)
    onClose()
  }

  const etiquetaTipo = acceptedTypes === 'application/pdf' ? 'PDF' : 'archivos'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : handleClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {currentFileUrl && (
          <Button
            variant="outline"
            onClick={() => window.open(currentFileUrl, '_blank', 'noopener,noreferrer')}
            className="w-full"
          >
            <ExternalLink />
            {viewCurrentLabel}
          </Button>
        )}

        <label
          htmlFor="documentFile"
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            selectedFile
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-accent'
          )}
        >
          <input
            id="documentFile"
            type="file"
            accept={acceptedTypes}
            className="sr-only"
            onChange={handleFileChange}
          />

          {selectedFile ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">{selectedFile.name}</p>
            </>
          ) : (
            <>
              <Paperclip className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Haz clic para seleccionar el archivo</p>
              <p className="text-xs text-muted-foreground">
                Solo {etiquetaTipo} (máx. {maxSizeMB} MB)
              </p>
            </>
          )}
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
            {isUploading ? 'Subiendo…' : uploadButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
