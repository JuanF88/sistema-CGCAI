'use client'
import { useSearchParams } from 'next/navigation'
import AuditorDashboard from '@/components/auditor/AuditorDashboard'

export default function Page() {
  const key = typeof window !== 'undefined' ? window.location.href + Date.now() : 'static'

  return <AuditorDashboard key={key} />
}
