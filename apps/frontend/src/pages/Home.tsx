import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function Home() {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to="/home" replace />
}


