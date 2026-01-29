import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Cliente con service role para operaciones administrativas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request) {
  try {
    // Verificar que tenemos el service role key
    if (!supabaseServiceRole) {
      return NextResponse.json(
        { error: 'Service role key no configurada' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Contraseña temporal solo para crear usuarios en Auth
    // Los usuarios nunca la usarán - sus contraseñas reales se migran en el primer login
    const TEMP_PASSWORD = 'TEMP_MIGRATION_PASSWORD_' + Math.random().toString(36)

    // 1. Obtener todos los usuarios de la tabla usuarios
    const { data: usuarios, error: fetchError } = await supabaseAdmin
      .from('usuarios')
      .select('*')

    if (fetchError) {
      console.error('Error al obtener usuarios:', fetchError)
      return NextResponse.json(
        { error: 'Error al obtener usuarios de la BD', details: fetchError },
        { status: 500 }
      )
    }

    if (!usuarios || usuarios.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron usuarios para migrar' },
        { status: 404 }
      )
    }

    console.log(`Iniciando migración de ${usuarios.length} usuarios...`)

    const resultados = {
      exitosos: [],
      errores: [],
      omitidos: [],
    }

    // 2. Migrar cada usuario (solo crear estructura, sin cambiar contraseñas)
    for (const usuario of usuarios) {
      try {
        // Si auth_user_id ya existe, asumir que ya está migrado
        if (usuario.auth_user_id) {
          console.log(`Usuario ${usuario.email} ya tiene auth_user_id, omitiendo...`)
          resultados.omitidos.push({
            email: usuario.email,
            razon: 'Ya tiene auth_user_id asignado',
          })
          continue
        }

        // Crear usuario en Supabase Auth con contraseña temporal
        // La contraseña real se actualizará en el primer login
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: usuario.email,
          password: TEMP_PASSWORD,
          email_confirm: true, // Auto-confirmar email
          user_metadata: {
            nombre: usuario.nombre || '',
            rol: usuario.rol || '',
            migrated_from_old_id: usuario.usuario_id,
            needs_password_migration: true, // Marcar que necesita migración de contraseña
          },
        })

        if (authError) {
          console.error(`Error al crear usuario ${usuario.email}:`, authError)
          resultados.errores.push({
            email: usuario.email,
            error: authError.message,
          })
          continue
        }

        // Actualizar la tabla usuarios con el nuevo ID de auth usando SQL directo
        // No podemos usar .update() porque la PK está cacheada
        const { data: updateData, error: updateError } = await supabaseAdmin.rpc('migrate_user_id', {
          old_user_id: usuario.usuario_id,
          new_user_id: authUser.user.id,
        })

        if (updateError) {
          console.error(`Error al actualizar usuario ${usuario.email}:`, updateError)
          resultados.errores.push({
            email: usuario.email,
            error: `Usuario creado en auth pero fallo actualización: ${updateError.message}`,
          })
          continue
        }

        console.log(`✓ Usuario migrado: ${usuario.email} -> ${authUser.user.id}`)
        resultados.exitosos.push({
          email: usuario.email,
          oldId: usuario.usuario_id,
          newId: authUser.user.id,
        })

      } catch (error) {
        console.error(`Error procesando usuario ${usuario.email}:`, error)
        resultados.errores.push({
          email: usuario.email,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      resumen: {
        total: usuarios.length,
        exitosos: resultados.exitosos.length,
        errores: resultados.errores.length,
        omitidos: resultados.omitidos.length,
      },
      resultados,
      mensaje: `Migración completada. ${resultados.exitosos.length} usuarios migrados. Las contraseñas se migrarán automáticamente en el primer login de cada usuario.`,
    })

  } catch (error) {
    console.error('Error en migración:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
