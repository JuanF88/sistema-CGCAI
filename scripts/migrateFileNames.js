/**
 * Script de migración de nombres de archivos en Supabase Storage
 * Elimina la fecha al final de los nombres para evitar problemas al cambiar fechas de auditoría
 * 
 * Ejemplo:
 *   PlanAuditoria_123_CONTADURIA_2026-01-20.pdf
 *   → PlanAuditoria_123_CONTADURIA.pdf
 * 
 * Uso: node scripts/migrateFileNames.js
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Cargar variables de entorno desde .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
config({ path: join(__dirname, '..', '.env.local') })

// ✅ Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wplfupxbqtpvwcdtqedw.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no encontradas')
  console.error('   NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben estar definidas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Buckets a procesar
const BUCKETS = [
  'planes',
  'asistencias',
  'evaluaciones',
  'actas',
  'actascompromiso',
  'validaciones',
]

// Patrón para detectar archivos con fecha: _YYYY-MM-DD.pdf
const DATE_PATTERN = /_(\d{4})-(\d{2})-(\d{2})\.(pdf|PDF)$/

/**
 * Procesa un bucket: lista archivos y los renombra
 */
async function processBucket(bucketName) {
  console.log(`\n📂 Procesando bucket: ${bucketName}`)
  console.log('─'.repeat(60))

  try {
    // 1. Listar todos los archivos del bucket
    const { data: files, error: listError } = await supabase
      .storage
      .from(bucketName)
      .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

    if (listError) {
      console.error(`   ❌ Error listando archivos: ${listError.message}`)
      return { success: 0, failed: 0, skipped: 0 }
    }

    if (!files || files.length === 0) {
      console.log('   ℹ️  Bucket vacío, nada que migrar')
      return { success: 0, failed: 0, skipped: 0 }
    }

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    // 2. Procesar cada archivo
    for (const file of files) {
      const oldName = file.name

      // Ignorar placeholders de carpetas vacías
      if (oldName.toLowerCase().includes('placeholder')) {
        continue
      }

      // Verificar si tiene fecha al final
      const match = oldName.match(DATE_PATTERN)
      if (!match) {
        console.log(`   ⏭️  Omitido (sin fecha): ${oldName}`)
        skippedCount++
        continue
      }

      // 3. Construir nuevo nombre (sin fecha)
      const newName = oldName.replace(DATE_PATTERN, '.$4')

      console.log(`   🔄 Renombrando:`)
      console.log(`      De: ${oldName}`)
      console.log(`      A:  ${newName}`)

      try {
        // 4. Copiar archivo al nuevo nombre
        const { data: copyData, error: copyError } = await supabase
          .storage
          .from(bucketName)
          .copy(oldName, newName)

        if (copyError) {
          console.error(`      ❌ Error copiando: ${copyError.message}`)
          failedCount++
          continue
        }

        // 5. Eliminar archivo antiguo
        const { error: deleteError } = await supabase
          .storage
          .from(bucketName)
          .remove([oldName])

        if (deleteError) {
          console.error(`      ⚠️  Copiado OK, pero no se pudo eliminar el antiguo: ${deleteError.message}`)
          // No incrementar failedCount porque el archivo nuevo está creado
        }

        console.log(`      ✅ Migrado exitosamente`)
        successCount++

      } catch (err) {
        console.error(`      ❌ Error inesperado: ${err.message}`)
        failedCount++
      }
    }

    console.log(`\n   📊 Resultado: ${successCount} exitosos, ${failedCount} fallidos, ${skippedCount} omitidos`)
    return { success: successCount, failed: failedCount, skipped: skippedCount }

  } catch (err) {
    console.error(`   ❌ Error general en bucket ${bucketName}: ${err.message}`)
    return { success: 0, failed: 0, skipped: 0 }
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   🔧 Script de Migración de Nombres de Archivos           ║')
  console.log('║   Elimina fechas al final de nombres de archivos          ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  const totalStats = {
    success: 0,
    failed: 0,
    skipped: 0,
  }

  // Procesar cada bucket
  for (const bucket of BUCKETS) {
    const stats = await processBucket(bucket)
    totalStats.success += stats.success
    totalStats.failed += stats.failed
    totalStats.skipped += stats.skipped
  }

  // Resumen final
  console.log('\n' + '═'.repeat(60))
  console.log('📊 RESUMEN FINAL')
  console.log('═'.repeat(60))
  console.log(`✅ Archivos migrados: ${totalStats.success}`)
  console.log(`❌ Errores: ${totalStats.failed}`)
  console.log(`⏭️  Omitidos (sin fecha): ${totalStats.skipped}`)
  console.log('═'.repeat(60))

  if (totalStats.failed > 0) {
    console.log('\n⚠️  Algunos archivos fallaron. Revisa los errores arriba.')
    process.exit(1)
  } else if (totalStats.success > 0) {
    console.log('\n🎉 ¡Migración completada exitosamente!')
    console.log('   Ahora los archivos mantienen el mismo nombre aunque cambies la fecha de auditoría.')
  } else {
    console.log('\nℹ️  No se encontraron archivos para migrar.')
  }
}

// Ejecutar
main().catch(err => {
  console.error('\n💥 Error fatal:', err)
  process.exit(1)
})
