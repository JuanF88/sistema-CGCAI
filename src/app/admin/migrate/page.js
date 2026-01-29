'use client'

import { useState } from 'react'
import styles from './migrate.module.css'

export default function MigratePage() {
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)

  const handleMigrate = async () => {
    if (!confirm('¿Estás seguro de ejecutar la migración? Esta acción creará usuarios en Supabase Auth y actualizará los IDs.')) {
      return
    }

    setLoading(true)
    setError(null)
    setResultado(null)

    try {
      const response = await fetch('/api/auth/migrate', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error en la migración')
        return
      }

      setResultado(data)
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>🔐 Migración de Usuarios a Supabase Auth</h1>
        
        <div className={styles.warning}>
          <h3>⚠️ IMPORTANTE - Lee antes de continuar:</h3>
          <ul>
            <li>Esta acción migrará TODOS los usuarios de la tabla <code>usuarios</code> a Supabase Auth</li>
            <li>Los IDs de los usuarios cambiarán a UUIDs de Supabase</li>
            <li><strong>Las contraseñas actuales se conservan</strong> - migración gradual transparente</li>
            <li>Los usuarios podrán seguir usando sus contraseñas actuales sin cambios</li>
            <li>En el primer login, su contraseña se migrará automáticamente a Supabase Auth</li>
            <li>NO se enviarán emails - el proceso es completamente transparente</li>
            <li>Esta operación NO se puede deshacer fácilmente</li>
          </ul>
        </div>

        <div className={styles.prerequisites}>
          <h3>📋 Pre-requisitos:</h3>
          <ol>
            <li>Asegúrate de tener configurado <code>SUPABASE_SERVICE_ROLE_KEY</code> en tu archivo <code>.env.local</code></li>
            <li>Haz un backup de tu base de datos antes de continuar</li>
            <li>Verifica que tu configuración de email esté funcionando en Supabase</li>
          </ol>
        </div>

        <button
          onClick={handleMigrate}
          disabled={loading}
          className={styles.button}
        >
          {loading ? '⏳ Migrando usuarios...' : '🚀 Ejecutar Migración'}
        </button>

        {error && (
          <div className={styles.error}>
            <h3>❌ Error:</h3>
            <p>{error}</p>
          </div>
        )}

        {resultado && (
          <div className={styles.success}>
            <h3>✅ Migración Completada</h3>
            
            <div className={styles.resumen}>
              <h4>📊 Resumen:</h4>
              <ul>
                <li>Total usuarios procesados: <strong>{resultado.resumen.total}</strong></li>
                <li className={styles.exitoso}>Migrados exitosamente: <strong>{resultado.resumen.exitosos}</strong></li>
                <li className={styles.omitido}>Omitidos (ya migrados): <strong>{resultado.resumen.omitidos}</strong></li>
                <li className={styles.errorItem}>Errores: <strong>{resultado.resumen.errores}</strong></li>
              </ul>
            </div>



            {resultado.resultados.exitosos.length > 0 && (
              <div className={styles.detalles}>
                <h4>✓ Usuarios migrados exitosamente:</h4>
                <ul>
                  {resultado.resultados.exitosos.map((u, i) => (
                    <li key={i}>
                      {u.email} <small>({u.oldId} → {u.newId})</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.resultados.errores.length > 0 && (
              <div className={styles.erroresDetalle}>
                <h4>⚠️ Usuarios con errores:</h4>
                <ul>
                  {resultado.resultados.errores.map((e, i) => (
                    <li key={i}>
                      {e.email}: <em>{e.error}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.resultados.omitidos.length > 0 && (
              <div className={styles.omitidosDetalle}>
                <h4>ℹ️ Usuarios omitidos:</h4>
                <ul>
                  {resultado.resultados.omitidos.map((o, i) => (
                    <li key={i}>
                      {o.email}: <em>{o.razon}</em>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.nextSteps}>
              <h4>🎯 Próximos pasos:</h4>
              <ol>
                <li>✅ Los usuarios pueden seguir usando sus contraseñas actuales</li>
                <li>✅ NO necesitas notificarles - el cambio es transparente</li>
                <li>Verifica que puedan hacer login correctamente</li>
                <li>En el primer login, sus contraseñas se migrarán automáticamente a Supabase Auth</li>
                <li>Después de que todos hayan iniciado sesión al menos una vez, puedes eliminar el campo <code>password</code> de la tabla usuarios</li>
                <li>Puedes proceder con el PASO 3 de la migración RLS</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
