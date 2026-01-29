'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/app/styles/Login.module.css'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react' // 👈 iconos para el ojito

const STORAGE_KEY_LAST_EMAIL = 'ultimoCorreoLogin' // 👈 clave de localStorage

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  // 👇 estado para alternar visibilidad de la contraseña
  const [mostrarPassword, setMostrarPassword] = useState(false)

  // 👇 al montar, precargamos el último correo
  useEffect(() => {
    try {
      const last = localStorage.getItem(STORAGE_KEY_LAST_EMAIL)
      if (last) setEmail(last)
    } catch { /* ignore */ }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()

    try {
      // Llamar a la API de login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrorMsg(data.error || 'Error al iniciar sesión')
        return
      }

      // ✅ guardamos el último correo usado
      try {
        localStorage.setItem(STORAGE_KEY_LAST_EMAIL, email)
      } catch { /* ignore */ }

      // Guardar datos del usuario (compatibilidad con código existente)
      localStorage.setItem('clienteLogueado', JSON.stringify(data.usuario))

      // ✅ Establecer la sesión en el cliente Supabase
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      // Redirigir según rol
      switch (data.usuario.rol.trim().toLowerCase()) {
        case 'auditor':
          router.push('/auditor')
          break
        case 'admin':
          router.push('/admin')
          break
        case 'gestor':
          router.push('/gestor')
          break
        default:
          setErrorMsg(`Rol no reconocido: ${data.usuario.rol}`)
      }
    } catch (error) {
      console.error('Error en login:', error)
      setErrorMsg('Error de conexión. Intenta nuevamente.')
    }
  }

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoContainer}>
          <Image
            src="/logoBlanco.png"
            alt="Logo Universidad"
            width={120}
            height={120}
            priority
            className={styles.logo}
          />
        </div>

        <h2 className={styles.subtitulo}>Sistema CGC-AI</h2>
        <h1 className={styles.titulo}>Auditorías Internas</h1>
        <h2 className={styles.subtitulo}>Iniciar Sesión</h2>

        <form onSubmit={handleLogin} className={styles.form}>
          <input
            type="email"
            placeholder="Correo"
            className={styles.input}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errorMsg) setErrorMsg(null) // limpia error al tipear
            }}
            required
            autoComplete="username"
          />

          {/* Campo de contraseña con ojito */}
          <div className={styles.inputWrapper /* agrega position:relative en CSS si no lo tienes */}>
            <input
              type={mostrarPassword ? 'text' : 'password'}
              placeholder="Contraseña"
              className={styles.input}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              required
              autoComplete="current-password"
              style={{ paddingRight: '2.5rem' }} // espacio para el icono
            />
            <button
              type="button"
              onClick={() => setMostrarPassword(v => !v)}
              aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className={styles.eyeButton /* define absolute right-3 top-1/2 -translate-y-1/2 en tu CSS */}
            >
              {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {errorMsg && <p className={styles.error}>{errorMsg}</p>}

          <button
            type="submit"
            className={styles.boton}
            disabled={!isFormValid}
          >
            ENTRAR
          </button>
        </form>
      </div>
    </div>
  )
}
