'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/app/styles/Login.module.css'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('estado', 'activo')
      .single()

    if (error || !data) {
      setErrorMsg('Correo, contraseña incorrectos o usuario inactivo')
    } else if (!data.rol) {
      setErrorMsg('Este usuario no tiene un rol definido.')
    } else {
      localStorage.setItem('clienteLogueado', JSON.stringify(data))
      switch (data.rol.trim().toLowerCase()) {
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
          setErrorMsg(`Rol no reconocido: ${data.rol}`)
      }
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
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {errorMsg && <p className={styles.error}>{errorMsg}</p>}

          <button
            type="submit"
            className={styles.boton}
            disabled={!isFormValid} // 👈 Desactiva si el form no es válido
          >
            ENTRAR
          </button>
        </form>
      </div>
    </div>
  )
}
