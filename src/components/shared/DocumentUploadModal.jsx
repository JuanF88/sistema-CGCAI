/**
 * Modal reutilizable para subir documentos PDF
 * Elimina duplicación de código entre componentes admin y auditor
 */

'use client'

import { useState } from 'react'
import styles from './DocumentUploadModal.module.css'

/**
 * @typedef {Object} DocumentUploadModalProps
 * @property {boolean} isOpen - Estado de apertura del modal
 * @property {Function} onClose - Callback al cerrar
 * @property {string} title - Título del modal
 * @property {string} [currentFileUrl] - URL del archivo actual (si existe)
 * @property {Function} onUpload - Callback al subir archivo (recibe File)
 * @property {boolean} [isUploading] - Estado de carga
 * @property {string} [maxSizeMB] - Tamaño máximo en MB (default: 2)
 * @property {string} [acceptedTypes] - Tipos MIME aceptados (default: application/pdf)
 * @property {string} [viewCurrentLabel] - Label para ver archivo actual
 * @property {string} [uploadButtonLabel] - Label del botón de subida
 */

export default function DocumentUploadModal({
  isOpen,
  onClose,
  title,
  currentFileUrl = null,
  onUpload,
  isUploading = false,
  maxSizeMB = 2,
  acceptedTypes = 'application/pdf',
  viewCurrentLabel = '👀 Ver archivo actual',
  uploadButtonLabel = 'Subir',
}) {
  const [selectedFile, setSelectedFile] = useState(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null
    
    if (file && file.size > maxSizeMB * 1024 * 1024) {
      alert(`El archivo supera el tamaño máximo de ${maxSizeMB}MB.`)
      e.target.value = null
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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContenido}>
        {/* Botón cerrar */}
        <button
          className={styles.modalCerrar}
          onClick={handleClose}
          title="Cerrar"
          aria-label="Cerrar modal"
        >
          ✖
        </button>

        {/* Título */}
        <h3 className={styles.modalTitulo}>{title}</h3>

        {/* Link a archivo actual */}
        {currentFileUrl && (
          <a
            href={currentFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnVerActual}
            onClick={(e) => {
              e.preventDefault()
              window.open(currentFileUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            {viewCurrentLabel}
          </a>
        )}

        {/* Área de drop/selección */}
        <label htmlFor="documentFile" className={styles.dropArea}>
          <input
            id="documentFile"
            type="file"
            accept={acceptedTypes}
            className={styles.inputArchivo}
            onChange={handleFileChange}
          />
          {!selectedFile ? (
            <>
              <div className={styles.iconoSubida}>📎</div>
              <p className={styles.instrucciones}>
                Haz clic para seleccionar el archivo
                <br />
                <span className={styles.subtexto}>
                  Solo {acceptedTypes === 'application/pdf' ? 'PDF' : 'archivos'} (máx. {maxSizeMB} MB)
                </span>
              </p>
            </>
          ) : (
            <p className={styles.nombreArchivo}>✅ {selectedFile.name}</p>
          )}
        </label>

        {/* Botones de acción */}
        <div className={styles.modalBotones}>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={styles.botonSubir}
          >
            {isUploading ? 'Subiendo…' : uploadButtonLabel}
          </button>
          <button
            onClick={handleClose}
            className={styles.botonCancelar}
            disabled={isUploading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
