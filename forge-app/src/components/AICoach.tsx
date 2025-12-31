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
} from 'lucide-react'

// Types
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: {
    type: 'workout' | 'nutrition' | 'sleep' | 'injury' | 'progress' | 'recommendation'
    data?: any
  }
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

    // Simulate AI response (would call actual API)
    setTimeout(() => {
      const responses = getSimulatedResponse(messageText)
      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: responses.content,
        timestamp: new Date(),
        context: responses.context,
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1500 + Math.random() * 1000)
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
          AI coach has access to your workouts, nutrition, sleep, and journal data
        </p>
      </div>
    </div>
  )
}

// Simulated responses based on user input
function getSimulatedResponse(input: string): { content: string; context?: Message['context'] } {
  const lowerInput = input.toLowerCase()

  if (lowerInput.includes('workout') || lowerInput.includes('training') || lowerInput.includes('today')) {
    return {
      content: `Based on your training history, here's what I recommend for today:

**Upper Body Push Focus**
You did legs 2 days ago and your sleep score last night was 82 - solid recovery.

Suggested workout:
• Bench Press: 4x6 @ 185lbs (up 5lbs from last week)
• Incline DB Press: 3x10
• Cable Flyes: 3x12
• Overhead Press: 3x8
• Tricep Pushdowns: 3x12

Your bench has been progressing well - you hit 180x6 with good form last week. Let's keep the momentum going!

Should I add this to your calendar?`,
      context: { type: 'workout' },
    }
  }

  if (lowerInput.includes('progress') || lowerInput.includes('trend') || lowerInput.includes('month')) {
    return {
      content: `Here's your training summary for December:

**Strength Progress** 📈
• Bench: 175 → 185 lbs (+5.7%)
• Squat: 225 → 245 lbs (+8.9%)
• Deadlift: 315 → 335 lbs (+6.3%)

**Consistency** ✅
• 18 workouts logged (4.5/week avg)
• Only missed 2 planned sessions

**Areas to Watch** ⚠️
• Sleep averaging 6.8 hours (target: 7.5)
• Protein intake dropped to 160g avg last week

Overall, great month! Your strength gains are solid. Focus on sleep and protein to maintain momentum.`,
      context: { type: 'progress' },
    }
  }

  if (lowerInput.includes('protein') || lowerInput.includes('nutrition') || lowerInput.includes('eating')) {
    return {
      content: `Looking at your nutrition data:

**This Week's Averages:**
• Calories: 2,280/day (target: 2,400)
• Protein: 162g/day (target: 180g) ⚠️
• Carbs: 245g/day
• Fat: 78g/day

You're about 18g short on protein daily. Easy fixes:
1. Add a protein shake post-workout (+24g)
2. Greek yogurt as a snack (+18g)
3. Extra egg at breakfast (+6g)

Your best protein day was Tuesday (195g) - what did you eat differently?`,
      context: { type: 'nutrition' },
    }
  }

  if (lowerInput.includes('sleep') || lowerInput.includes('recovery') || lowerInput.includes('hrv') || lowerInput.includes('recovered')) {
    return {
      content: `Your recovery status looks solid today:

**Last Night:**
• Sleep Score: 82 ✅
• Total Sleep: 7h 15m
• Deep Sleep: 1h 25m (19%)
• HRV: 48ms (up from 42 yesterday)
• Resting HR: 52 bpm

**Trend:** Your HRV has been climbing this week, suggesting good adaptation to training. You're well-recovered for a high-intensity session.

**Recommendation:** Green light for hard training today. Your body has adapted well to last week's volume.`,
      context: { type: 'sleep' },
    }
  }

  if (lowerInput.includes('injury') || lowerInput.includes('pain') || lowerInput.includes('knee') || lowerInput.includes('hurt')) {
    return {
      content: `I see you logged some knee discomfort recently. Let me help:

**Immediate Modifications:**
• Replace back squats with leg press (less knee flexion)
• Avoid deep lunges - stick to partial range
• Add 5 min of cycling warm-up before leg work
• Include VMO-focused exercises (terminal knee extensions)

**Recommended Additions:**
• Copenhagen planks for adductor strength
• Glute bridges to reduce knee stress
• Foam rolling quads and IT band

**Monitor:** If pain persists beyond 2 weeks or worsens, consider seeing a physio. Would you like me to adjust your upcoming leg workouts?`,
      context: { type: 'injury' },
    }
  }

  if (lowerInput.includes('goal') || lowerInput.includes('plan') || lowerInput.includes('month')) {
    return {
      content: `Let's set up your Q1 2025 goals based on your current levels:

**Realistic 3-Month Targets:**

*Strength:*
• Bench: 185 → 205 lbs (+11%)
• Squat: 245 → 275 lbs (+12%)
• Deadlift: 335 → 365 lbs (+9%)

*Body Composition:*
• Maintain ~185 lbs bodyweight
• Target 180g protein daily

*Cardio:*
• Sub-25 min 5K (currently ~27 min)
• 2 zone 2 sessions/week

*Recovery:*
• Average 7+ hours sleep
• Weekly HRV trending up

Should I create a periodized training plan to hit these targets?`,
      context: { type: 'recommendation' },
    }
  }

  // Default response
  return {
    content: `I'm here to help with your training! I can:

• **Suggest workouts** based on your history and recovery
• **Analyze progress** across strength, nutrition, and sleep
• **Provide modifications** if you're dealing with injuries
• **Plan goals** and create periodized training blocks
• **Answer questions** about technique, nutrition timing, etc.

What would you like to focus on?`,
  }
}
