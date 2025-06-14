'use client'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default function Page() {
  const key = typeof window !== 'undefined' ? window.location.href + Date.now() : 'static'

  return <AdminDashboard key={key} />
}
