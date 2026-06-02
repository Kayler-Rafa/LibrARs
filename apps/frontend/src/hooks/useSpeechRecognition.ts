import { useRef, useState, useCallback } from 'react'

export interface UseSpeechRecognitionReturn {
  isListening: boolean
  isSupported: boolean
  interimText: string
  start: () => void
  stop: () => void
}

export function useSpeechRecognition(
  onFinalResult: (text: string) => void,
  onInterim?: (text: string) => void
): UseSpeechRecognitionReturn {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  const isSupported = !!SpeechRecognition

  const recRef = useRef<any>(null)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')

  const start = useCallback(() => {
    if (!isSupported || isListening) return

    const rec = new SpeechRecognition()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => setIsListening(true)
    rec.onend = () => {
      setIsListening(false)
      setInterimText('')
    }

    rec.onresult = (e: any) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }
      setInterimText(interim)
      onInterim?.(interim)
      if (final.trim()) {
        onFinalResult(final.trim())
        setInterimText('')
      }
    }

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        setIsListening(false)
        setInterimText('')
      }
    }

    recRef.current = rec
    rec.start()
  }, [isSupported, isListening, onFinalResult, onInterim])

  const stop = useCallback(() => {
    recRef.current?.stop()
    recRef.current = null
    setIsListening(false)
    setInterimText('')
  }, [])

  return { isListening, isSupported, interimText, start, stop }
}
