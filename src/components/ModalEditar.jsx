// components/ModalEditar.jsx
'use client'

import styles from './CSS/modal.module.css'

export default function ModalEditar({ visible, onClose, children }) {
  if (!visible) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className={styles.close}>✖</button>
        {children}
      </div>
    </div>
  )
}
