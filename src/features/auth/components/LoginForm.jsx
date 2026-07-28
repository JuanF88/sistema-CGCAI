'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'

import { supabase } from '@/lib/supabase/client'
import { HOME_BY_ROLE, normalizeRole } from '@/lib/auth/roles'
import { iniciarSesion } from '@/features/auth/api/auth-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STORAGE_KEY_LAST_EMAIL = 'ultimoCorreoLogin'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)

  // Precargamos el último correo usado (solo comodidad, no es una sesión).
  useEffect(() => {
    try {
      const last = localStorage.getItem(STORAGE_KEY_LAST_EMAIL)
      if (last) setEmail(last)
    } catch {
      /* localStorage puede estar bloqueado */
    }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setEnviando(true)

    try {
      const data = await iniciarSesion({ email, password })

      try {
        localStorage.setItem(STORAGE_KEY_LAST_EMAIL, email)
      } catch {
        /* ignore */
      }

      // Sincroniza la sesión en el cliente con la que ya dejó el servidor en
      // las cookies, para que Storage y las consultas directas funcionen.
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      const destino = HOME_BY_ROLE[normalizeRole(data.usuario?.rol)]

      if (!destino) {
        setErrorMsg(`Rol no reconocido: ${data.usuario?.rol ?? 'sin rol'}`)
        return
      }

      router.replace(destino)
      router.refresh()
    } catch (error) {
      console.error('Error en login:', error)
      setErrorMsg(error?.message || 'Error de conexión. Intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  const isFormValid = email.trim() !== '' && password.trim() !== ''

  return (
    <div className="bg-login flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* El logo es blanco: va sobre el fondo azul, no dentro de la tarjeta. */}
      <Image
        src="/logoBlanco.png"
        alt="Logo Universidad"
        width={130}
        height={130}
        priority
        className="h-24 w-auto drop-shadow-lg sm:h-[130px]"
      />

      <div className="animate-fade-in w-full max-w-md rounded-2xl bg-white/95 p-8 text-center shadow-[0_15px_30px_rgba(0,0,0,0.2)] backdrop-blur-sm">
        <p className="text-lg font-light text-[#002b9e]">Sistema CGC-AI</p>
        <h1 className="mb-1 text-[2.2rem] font-bold leading-tight tracking-wide text-[#002b9e] drop-shadow-sm">
          Auditorías Internas
        </h1>
        <p className="mb-6 text-lg font-light text-[#002b9e]">Iniciar sesión</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email" className="text-slate-700">
              Correo
            </Label>
            <Input
              id="login-email"
              type="email"
              placeholder="usuario@correo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              required
              autoComplete="username"
              className="h-11 bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-password" className="text-slate-700">
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="login-password"
                type={mostrarPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errorMsg) setErrorMsg(null)
                }}
                required
                autoComplete="current-password"
                className="h-11 bg-white pr-11"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-slate-800"
              >
                {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {errorMsg}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!isFormValid || enviando}
            className="mx-auto mt-2 rounded-2xl bg-gradient-to-r from-[#0043b7] to-[#002b9e] px-8 font-bold tracking-wide transition-transform hover:scale-[1.03] hover:brightness-110"
          >
            {enviando ? 'ENTRANDO…' : 'ENTRAR'}
          </Button>
        </form>
      </div>

      <Image
        src="/logosIcontec2.png"
        alt="Logo Icontec"
        width={120}
        height={40}
        className="h-12 w-auto opacity-90 drop-shadow"
      />
    </div>
  )
}
