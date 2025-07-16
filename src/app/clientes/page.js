'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation' // ✅ Válido en App Router
import { supabase } from '@/lib/supabaseClient'

export default function ClientesPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const session = localStorage.getItem('clienteLogueado')
    if (!session) {
      router.push('/login')
      return
    }

    const fetchClientes = async () => {
      const { data, error } = await supabase.from('usuarios').select('*')
      if (error) console.error(error)
      else setClientes(data)
      setLoading(false)
    }

    
    fetchClientes()
  }, [router])

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Lista de Usuarios</h1>
      {loading ? <p>Cargando...</p> : (
        <ul>
          {clientes.map(cliente => (
            <li key={cliente.id}>
              <strong>{cliente.nombre}</strong> - {cliente.email}
            </li>
          ))}
        </ul>
      )}
    </div>
    
  )

  
}
