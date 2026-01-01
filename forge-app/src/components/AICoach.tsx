'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send,
  Bot,
  User,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Calendar,
  Apple,
  Moon,
  Heart,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  Lightbulb,
  Target,
  Zap,
  Check,
  X,
  Loader2,
  Wrench,
} from 'lucide-react'
import { PendingAction, ToolName, ToolResult } from '@/types/ai-tools'

// Types
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: {
    type: 'workout' | 'nutrition' | 'sleep' | 'injury' | 'progress' | 'recommendation' | 'action'
    data?: any
  }
  executedTools?: { name: ToolName; result: ToolResult }[]
}

interface QuickAction {
  icon: React.ElementType
  label: string
  prompt: string
  color: string
}

// Quick action suggestions
const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Dumbbell,
    label: 'Suggest workout',
    prompt: "Based on my recent training, what should I do for today's workout?",
    color: 'text-violet-400 bg-violet-500/20',
  },
  {
    icon: TrendingUp,
    label: 'Analyze progress',
    prompt: "How has my training been going this month? Any trends I should know about?",
    color: 'text-emerald-400 bg-emerald-500/20',
  },
  {
    icon: Apple,
    label: 'Nutrition check',
    prompt: "Am I hitting my protein goals? How's my nutrition been lately?",
    color: 'text-amber-400 bg-amber-500/20',
  },
  {
    icon: Moon,
    label: 'Recovery status',
    prompt: "Based on my sleep and HRV data, how recovered am I? Should I push hard today?",
    color: 'text-sky-400 bg-sky-500/20',
  },
  {
    icon: AlertCircle,
    label: 'Injury advice',
    prompt: "I have some knee discomfort. What modifications should I make to my training?",
    color: 'text-red-400 bg-red-500/20',
  },
  {
    icon: Target,
    label: 'Goal planning',
    prompt: "Help me set realistic goals for the next 3 months based on my current fitness level.",
    color: 'text-purple-400 bg-purple-500/20',
  },
]

// Sample conversation for demo
const SAMPLE_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hey! I'm your AI training coach. I have access to your workout history, nutrition logs, sleep data, and journal entries. How can I help you optimize your training today?",
    timestamp: new Date(Date.now() - 60000),
  },
]

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

// Pending action confirmation card
function PendingActionCard({
  action,
  onApprove,
  onReject,
  isProcessing,
}: {
  action: PendingAction
  onApprove: () => void
  onReject: () => void
  isProcessing: boolean
}) {
  const getActionIcon = (toolName: ToolName) => {
    switch (toolName) {
      case 'reschedule_workout':
        return Calendar
      case 'add_workout':
        return Dumbbell
      case 'delete_workout':
        return X
      default:
        return Wrench
    }
  }

  const Icon = getActionIcon(action.tool_name)

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 my-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Icon size={20} className="text-amber-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-400">Confirm Action</h4>
          <p className="text-sm text-white/70 mt-1">{action.description}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Executed tool badge
function ExecutedToolBadge({ tool }: { tool: { name: ToolName; result: ToolResult } }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
      tool.result.success
        ? 'bg-emerald-500/20 text-emerald-400'
        : 'bg-red-500/20 text-red-400'
    }`}>
      {tool.result.success ? <Check size={12} /> : <X size={12} />}
      <span>{tool.result.message}</span>
    </div>
  )
}

// Message bubble
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-amber-500' : 'bg-violet-500/20'
      }`}>
        {isUser ? (
          <User size={16} className="text-black" />
        ) : (
          <Bot size={16} className="text-violet-400" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser 
            ? 'bg-amber-500 text-black rounded-tr-sm' 
            : 'bg-white/5 rounded-tl-sm'
        }`}>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* Executed tools */}
        {message.executedTools && message.executedTools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.executedTools.map((tool, i) => (
              <ExecutedToolBadge key={i} tool={tool} />
            ))}
          </div>
        )}

        {/* Context badge */}
        {message.context && (
          <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
            isUser ? 'ml-auto' : ''
          } bg-white/5 text-white/40`}>
            {message.context.type === 'workout' && <Dumbbell size={10} />}
            {message.context.type === 'nutrition' && <Apple size={10} />}
            {message.context.type === 'sleep' && <Moon size={10} />}
            {message.context.type === 'injury' && <AlertCircle size={10} />}
            {message.context.type === 'progress' && <TrendingUp size={10} />}
            {message.context.type === 'recommendation' && <Lightbulb size={10} />}
            {message.context.type === 'action' && <Wrench size={10} />}
            <span className="capitalize">{message.context.type}</span>
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-white/30 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// Insight card (for coach recommendations)
function InsightCard({ 
  icon: Icon, 
  title, 
  description, 
  action,
  color,
}: { 
  icon: React.ElementType
  title: string
  description: string
  action?: string
  color: string
}) {
  return (
    <div className="glass rounded-xl p-4 hover:bg-white/[0.03] transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium">{title}</h4>
          <p className="text-sm text-white/60 mt-0.5">{description}</p>
          {action && (
            <button className="text-sm text-amber-400 mt-2 flex items-center gap-1 hover:text-amber-300">
              {action} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Main AI Coach component
export function AICoach() {
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showInsights, setShowInsights] = useState(true)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText) return

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setShowInsights(false)
    setIsTyping(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      // Create assistant message
      const assistantMessage: Message = {
        id: data.message_id || `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        executedTools: data.executed_tools,
        context: data.executed_tools?.length > 0 ? { type: 'action' } : undefined,
      }
      setMessages(prev => [...prev, assistantMessage])

      // Dispatch events for executed tools so other components can refresh
      if (data.executed_tools?.length > 0) {
        data.executed_tools.forEach((tool: { name: string; result: { success: boolean } }) => {
          if (tool.result.success) {
            if (tool.name === 'add_workout' || tool.name === 'reschedule_workout' || tool.name === 'skip_workout' || tool.name === 'modify_workout_exercise') {
              window.dispatchEvent(new CustomEvent('workout-updated'))
            }
            if (tool.name === 'log_sleep') {
              window.dispatchEvent(new CustomEvent('sleep-updated'))
            }
            if (tool.name === 'log_meal') {
              window.dispatchEvent(new CustomEvent('nutrition-updated'))
            }
            if (tool.name === 'log_body_comp') {
              window.dispatchEvent(new CustomEvent('body-comp-updated'))
            }
          }
        })
      }

      // Handle pending confirmation
      if (data.pending_confirmation) {
        setPendingAction(data.pending_confirmation)
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: "I'm having trouble processing that request. Please try again.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleApproveAction = async () => {
    if (!pendingAction) return

    setIsProcessingAction(true)
    try {
      const response = await fetch('/api/ai/execute-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: pendingAction.id,
          tool_name: pendingAction.tool_name,
          tool_input: pendingAction.tool_input,
          approved: true,
        }),
      })

      const result = await response.json()

      // Add confirmation message
      const confirmationMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.success ? `Done! ${result.message}` : `Failed: ${result.message}`,
        timestamp: new Date(),
        context: { type: 'action' },
      }
      setMessages(prev => [...prev, confirmationMessage])
      setPendingAction(null)
    } catch (error) {
      console.error('Execute tool error:', error)
    } finally {
      setIsProcessingAction(false)
    }
  }

  const handleRejectAction = () => {
    setPendingAction(null)
    const rejectMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: "No problem, I've cancelled that action. What would you like to do instead?",
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, rejectMessage])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.prompt)
  }

  const resetChat = () => {
    setMessages(SAMPLE_MESSAGES)
    setShowInsights(true)
    setPendingAction(null)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
            <Bot size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="font-semibold">AI Coach</h1>
            <p className="text-sm text-white/50">Your personal training assistant</p>
          </div>
        </div>
        <button
          onClick={resetChat}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
              <Bot size={16} className="text-violet-400" />
            </div>
            <div className="bg-white/5 rounded-2xl rounded-tl-sm">
              <TypingIndicator />
            </div>
          </div>
        )}

        {/* Pending action confirmation */}
        {pendingAction && (
          <PendingActionCard
            action={pendingAction}
            onApprove={handleApproveAction}
            onReject={handleRejectAction}
            isProcessing={isProcessingAction}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Insights panel (shown initially) */}
      {showInsights && messages.length <= 1 && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-sm text-white/40 flex items-center gap-2">
            <Sparkles size={14} />
            Today's Insights
          </p>
          
          <InsightCard
            icon={Zap}
            title="Recovery looking good"
            description="Your HRV is up 12% from last week. Great time for a high-intensity session."
            action="See details"
            color="bg-emerald-500/20 text-emerald-400"
          />
          
          <InsightCard
            icon={Target}
            title="Protein target reminder"
            description="You've been averaging 165g/day. Increase by 15g to hit your 180g goal."
            action="View nutrition"
            color="bg-amber-500/20 text-amber-400"
          />
          
          <InsightCard
            icon={Calendar}
            title="Deload week suggestion"
            description="You've had 4 consecutive hard training weeks. Consider reducing volume by 40%."
            action="Adjust plan"
            color="bg-sky-500/20 text-sky-400"
          />
        </div>
      )}

      {/* Quick actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${action.color} hover:opacity-80`}
              >
                <action.icon size={14} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-white/5">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach anything..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none min-h-[48px] max-h-[120px]"
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 bottom-2 p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <p className="text-xs text-white/30 mt-2 text-center">
          AI coach can make changes to your workouts, log data, and answer questions
        </p>
      </div>
    </div>
  )
}
