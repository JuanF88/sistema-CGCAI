'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()

    // Consultamos todos los campos del usuario
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single()

    if (error || !data) {
      setErrorMsg('Correo o contraseña incorrectos')
    } else if (!data.rol) {
      setErrorMsg('Este usuario no tiene un rol definido.')
    } else {
      localStorage.setItem('clienteLogueado', JSON.stringify(data))

      // Redirigimos por rol
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-blue-100 to-pink-100">
      <div className="bg-white/90 backdrop-blur-lg shadow-xl rounded-2xl p-10 w-full max-w-md animate-fade-in">
        <h1 className="text-3xl font-bold text-center text-purple-700 mb-8">Iniciar Sesión</h1>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Correo</label>
            <input
              type="email"
              className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Contraseña</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-gradient-to-r from-blue-400 to-purple-400 text-white font-semibold rounded-lg hover:brightness-110 transition"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
