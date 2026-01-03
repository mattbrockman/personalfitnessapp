'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle, AlertCircle, Info, X, AlertTriangle, Trophy } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning' | 'celebration'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
  celebration: Trophy,
}

const toastStyles = {
  success: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
  error: 'bg-red-500/20 border-red-500/30 text-red-400',
  info: 'bg-sky-500/20 border-sky-500/30 text-sky-400',
  warning: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
  celebration: 'bg-gradient-to-r from-amber-500/30 via-yellow-500/30 to-amber-500/30 border-amber-400/50 text-amber-300',
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const Icon = toastIcons[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove()
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [toast.duration, onRemove])

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-lg animate-slide-up ${toastStyles[toast.type]}`}
    >
      <Icon size={20} className="flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-medium text-white">{toast.message}</p>
      <button
        onClick={onRemove}
        aria-label="Dismiss notification"
        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
      >
        <X size={16} className="text-white/60" aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, type, message, duration }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}

      {/* Toast container */}
      <div
        className="fixed bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-96 z-50 space-y-2 pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem
              toast={toast}
              onRemove={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Convenience hooks for common toast types
export function useSuccessToast() {
  const { addToast } = useToast()
  return useCallback((message: string) => addToast('success', message), [addToast])
}

export function useErrorToast() {
  const { addToast } = useToast()
  return useCallback((message: string) => addToast('error', message), [addToast])
}

export function useInfoToast() {
  const { addToast } = useToast()
  return useCallback((message: string) => addToast('info', message), [addToast])
}

export function useWarningToast() {
  const { addToast } = useToast()
  return useCallback((message: string) => addToast('warning', message), [addToast])
}

export function useCelebrationToast() {
  const { addToast } = useToast()
  return useCallback((message: string) => addToast('celebration', message, 5000), [addToast])
}
