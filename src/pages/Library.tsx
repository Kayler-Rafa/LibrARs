import { GestureLibrary } from '@/components/gestures/GestureLibrary'
import { Link } from 'react-router-dom'

export default function Library() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Biblioteca de Gestos</h1>
        <p className="text-sm text-gray-500">Gerencie, exporte e importe seus gestos</p>
      </div>

      <GestureLibrary />

      <p className="text-center text-sm text-gray-400">
        Para gravar novos gestos, vá para{' '}
        <Link to="/treinar" className="text-blue-600 hover:underline">
          Treinar
        </Link>
        .
      </p>
    </div>
  )
}
