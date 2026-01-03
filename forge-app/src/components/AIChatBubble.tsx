'use client'

import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import {
  Bot,
  X,
  Send,
  User,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Moon,
  Minimize2,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_PROMPTS = [
  { icon: Dumbbell, label: 'Suggest workout', prompt: "What should I do for today's workout?" },
  { icon: TrendingUp, label: 'Weekly review', prompt: "How's my training going this week?" },
  { icon: Moon, label: 'Recovery check', prompt: "Am I recovered enough to train hard today?" },
]

// Context for controlling AI chat from anywhere
interface AIChatContextType {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
}

const AIChatContext = createContext<AIChatContextType | null>(null)

export function useAIChat() {
  const context = useContext(AIChatContext)
  if (!context) {
    // Return no-op functions if not within provider (graceful degradation)
    return {
      isOpen: false,
      openChat: () => {},
      closeChat: () => {},
      toggleChat: () => {},
    }
  }
  return context
}

interface AIChatBubbleProps {
  showFloatingButton?: boolean // Set to false to hide the floating bubble
}

export function AIChatBubble({ showFloatingButton = true }: AIChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load chat history when opened
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      fetchChatHistory()
    }
  }, [isOpen, historyLoaded])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchChatHistory = async () => {
    try {
      const response = await fetch('/api/ai/chat')
      if (response.ok) {
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at),
          })))
        } else {
          // Add welcome message if no history
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Hey! I'm your AI coach. I have access to your workouts, sleep data, training plan, and readiness scores. Ask me anything about your training!",
            timestamp: new Date(),
          }])
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err)
      // Still show welcome on error
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey! I'm your AI coach. Ask me anything about your training!",
        timestamp: new Date(),
      }])
    } finally {
      setHistoryLoaded(true)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to get response')
      }

      const data = await response.json()

      const aiResponse: Message = {
        id: data.message_id || `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, aiResponse])

      // Signal updates for other components to refresh
      if (data.executed_tools?.length > 0) {
        console.log('[AIChatBubble] executed_tools:', data.executed_tools)
        data.executed_tools.forEach((tool: { name: string; result: { success: boolean } }) => {
          console.log('[AIChatBubble] Tool:', tool.name, 'Success:', tool.result?.success)
          if (tool.result?.success) {
            if (tool.name === 'add_workout' || tool.name === 'reschedule_workout' || tool.name === 'skip_workout' || tool.name === 'modify_workout_exercise') {
              console.log('[AIChatBubble] Dispatching workout-updated event')
              localStorage.setItem('workout-updated', Date.now().toString())
              window.dispatchEvent(new CustomEvent('workout-updated'))
            }
          }
        })
      }
    } catch (err: any) {
      console.error('Chat error:', err)
      setError(err.message || 'Failed to get response. Please try again.')
      // Remove the user message if there was an error
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
      setInput(userMessage.content) // Restore the input
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    // Use setTimeout to ensure input is set before sending
    setTimeout(() => {
      const textarea = inputRef.current
      if (textarea) {
        textarea.focus()
      }
    }, 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Handle escape key to close chat
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [handleEscapeKey])

  // Context value for external control
  const contextValue: AIChatContextType = {
    isOpen,
    openChat: () => setIsOpen(true),
    closeChat: () => setIsOpen(false),
    toggleChat: () => setIsOpen(prev => !prev),
  }

  // Listen for custom events to open/close chat
  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true)
    const handleCloseChat = () => setIsOpen(false)
    const handleToggleChat = () => setIsOpen(prev => !prev)

    window.addEventListener('ai-chat-open', handleOpenChat)
    window.addEventListener('ai-chat-close', handleCloseChat)
    window.addEventListener('ai-chat-toggle', handleToggleChat)

    return () => {
      window.removeEventListener('ai-chat-open', handleOpenChat)
      window.removeEventListener('ai-chat-close', handleCloseChat)
      window.removeEventListener('ai-chat-toggle', handleToggleChat)
    }
  }, [])

  return (
    <AIChatContext.Provider value={contextValue}>
      {/* Chat bubble button - only show if showFloatingButton is true */}
      {showFloatingButton && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Coach chat"
          aria-expanded={isOpen}
          aria-controls="ai-chat-window"
          className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 w-14 h-14 bg-violet-500 hover:bg-violet-400 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
        >
          <Bot size={24} className="text-white" aria-hidden="true" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center" aria-hidden="true">
            <Sparkles size={10} className="text-black" />
          </span>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div
          id="ai-chat-window"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-chat-title"
          className="fixed bottom-20 lg:bottom-6 right-2 left-2 lg:left-auto lg:right-6 lg:w-[380px] h-[70vh] max-h-[500px] bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden z-50 animate-slide-up focus-trap"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-violet-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500 rounded-full flex items-center justify-center" aria-hidden="true">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 id="ai-chat-title" className="font-semibold text-sm">FORGE Coach</h3>
                <p className="text-xs text-white/60">AI Training Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Minimize chat"
                className="p-2 min-h-touch min-w-touch hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
              >
                <Minimize2 size={16} className="text-white/60" aria-hidden="true" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="p-2 min-h-touch min-w-touch hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
              >
                <X size={16} className="text-white/60" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4"
            role="log"
            aria-label="Chat messages"
            aria-live="polite"
          >
            {!historyLoaded ? (
              <div className="flex items-center justify-center h-full" aria-label="Loading chat history">
                <Loader2 size={24} className="animate-spin text-secondary" aria-hidden="true" />
                <span className="sr-only">Loading chat history...</span>
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    role="article"
                    aria-label={`${message.role === 'user' ? 'You' : 'AI Coach'}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.role === 'user' ? 'bg-amber-500' : 'bg-violet-500'
                      }`}
                      aria-hidden="true"
                    >
                      {message.role === 'user' ? (
                        <User size={14} className="text-black" />
                      ) : (
                        <Bot size={14} className="text-white" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                        message.role === 'user'
                          ? 'bg-amber-500 text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3" role="status" aria-label="AI is typing">
                    <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center" aria-hidden="true">
                      <Bot size={14} className="text-white" />
                    </div>
                    <div className="bg-white/10 rounded-2xl px-4 py-3">
                      <div className="flex gap-1" aria-hidden="true">
                        <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="sr-only">AI Coach is typing...</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400"
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircle size={16} aria-hidden="true" />
                    {error}
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {historyLoaded && messages.length <= 2 && (
            <div className="px-4 pb-2">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {QUICK_PROMPTS.map((prompt, idx) => {
                  const Icon = prompt.icon
                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuickPrompt(prompt.prompt)}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs whitespace-nowrap transition-colors disabled:opacity-50"
                    >
                      <Icon size={12} className="text-violet-400" />
                      {prompt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-end gap-2">
              <label htmlFor="chat-input" className="sr-only">Message to AI Coach</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your coach..."
                rows={1}
                disabled={isLoading}
                aria-label="Message to AI Coach"
                aria-describedby="chat-hint"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck="false"
                data-form-type="other"
                enterKeyHint="send"
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-tertiary focus:outline-none focus:border-violet-500/50 resize-none max-h-[100px] disabled:opacity-50"
              />
              <span id="chat-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</span>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label={isLoading ? 'Sending message...' : 'Send message'}
                className="p-3 min-h-touch min-w-touch bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:hover:bg-violet-500 rounded-xl transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 size={18} className="text-white animate-spin" aria-hidden="true" />
                ) : (
                  <Send size={18} className="text-white" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AIChatContext.Provider>
  )
}

// Helper function to trigger AI chat open from anywhere
export function openAIChat() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-chat-open'))
  }
}

export function closeAIChat() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-chat-close'))
  }
}

export function toggleAIChat() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ai-chat-toggle'))
  }
}
