import { useRef } from 'react'
import { useGestureStore } from '@/stores/gestureStore'
import { formatDate } from '@/lib/utils'

export function GestureLibrary() {
  const { gestures, deleteGesture, exportAsJson, importFromJson } = useGestureStore()
  const importRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const json = exportAsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `libras-gestos-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => importFromJson(reader.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-base">
          Biblioteca Local
          {gestures.length > 0 && (
            <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {gestures.length} gesto{gestures.length !== 1 ? 's' : ''}
            </span>
          )}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => importRef.current?.click()}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-md transition-colors"
            aria-label="Importar gestos de arquivo JSON"
          >
            Importar
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="sr-only"
            aria-hidden="true"
          />
          {gestures.length > 0 && (
            <button
              onClick={handleExport}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-md transition-colors"
              aria-label="Exportar todos os gestos como JSON"
            >
              Exportar
            </button>
          )}
        </div>
      </div>

      {gestures.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">🤲</p>
          <p className="text-sm">Nenhum gesto cadastrado ainda.</p>
          <p className="text-xs mt-1">Grave o primeiro gesto acima.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Lista de gestos cadastrados">
          {gestures.map(g => (
            <li
              key={g.id}
              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{g.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {g.sampleCount} amostras · {formatDate(g.createdAt)}
                </p>
              </div>
              <button
                onClick={() => deleteGesture(g.id)}
                className="ml-3 text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 flex-shrink-0"
                aria-label={`Excluir gesto ${g.name}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
