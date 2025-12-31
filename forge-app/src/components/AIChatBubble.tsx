'use client'

import { useState, useRef, useEffect } from 'react'
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
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIChatBubbleProps {
  workoutContext?: {
    weeklyTSS?: number
    completedWorkouts?: number
    plannedWorkouts?: number
  }
}

const QUICK_PROMPTS = [
  { icon: Dumbbell, label: 'Suggest workout', prompt: "What should I do for today's workout?" },
  { icon: TrendingUp, label: 'Weekly review', prompt: "How's my training going this week?" },
  { icon: Moon, label: 'Recovery check', prompt: "Am I recovered enough to train hard today?" },
]

export function AIChatBubble({ workoutContext }: AIChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm your AI coach. Ask me about your training, nutrition, or recovery.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getSimulatedResponse(input, workoutContext),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiResponse])
      setIsTyping(false)
    }, 1500)
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => handleSend(), 100)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat bubble button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-violet-500 hover:bg-violet-400 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
        >
          <Bot size={24} className="text-white" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
            <Sparkles size={10} className="text-black" />
          </span>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[500px] bg-zinc-900 rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden z-50 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-violet-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500 rounded-full flex items-center justify-center">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">FORGE Coach</h3>
                <p className="text-xs text-white/50">AI Training Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Minimize2 size={16} className="text-white/60" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={16} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' ? 'bg-amber-500' : 'bg-violet-500'
                  }`}
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
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-white/10 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {QUICK_PROMPTS.map((prompt, idx) => {
                  const Icon = prompt.icon
                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuickPrompt(prompt.prompt)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs whitespace-nowrap transition-colors"
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
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your coach..."
                rows={1}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none max-h-[100px]"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="p-2.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:hover:bg-violet-500 rounded-xl transition-colors"
              >
                <Send size={18} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Simulated responses (replace with actual AI API)
function getSimulatedResponse(input: string, context?: AIChatBubbleProps['workoutContext']): string {
  const lower = input.toLowerCase()

  if (lower.includes('workout') || lower.includes('train')) {
    return "Based on your recent training pattern, I'd recommend a moderate Zone 2 ride today - about 60-90 minutes. Your body needs some aerobic base work before your next hard session. Want me to create a specific workout plan?"
  }

  if (lower.includes('recovery') || lower.includes('recovered')) {
    return "Looking at your training load, you've accumulated good stress this week. Your body should be ready for a quality session today. Just make sure you're well-fueled and hydrated!"
  }

  if (lower.includes('week') || lower.includes('progress')) {
    const tss = context?.weeklyTSS || 350
    return `This week you've logged ${tss} TSS so far. You're on track for your weekly goal! Keep up the consistent work - the gains are coming from showing up every day.`
  }

  if (lower.includes('nutrition') || lower.includes('eat') || lower.includes('protein')) {
    return "For your current training load, aim for 1.6-2g of protein per kg of body weight. Focus on getting protein within 30 minutes post-workout for optimal recovery. Are you tracking your nutrition?"
  }

  return "I'm here to help with your training, nutrition, and recovery. Feel free to ask me anything about your fitness journey - I have access to all your data and can give personalized recommendations!"
}
