'use client'

import { useState } from 'react'
import {
  Search,
  Plus,
  X,
  Calendar,
  Tag,
  AlertCircle,
  ChevronRight,
  Filter,
  BookOpen,
  Activity,
  Heart,
  Target,
  Zap,
  Check,
  Edit2,
  Trash2,
} from 'lucide-react'

// Types
interface JournalEntry {
  id: string
  entry_date: string
  entry_time?: string
  title?: string
  content: string
  entry_type: 'general' | 'injury' | 'recovery' | 'goal' | 'milestone' | 'equipment' | 'technique'
  body_parts?: string[]
  severity?: number  // 1-5 for injuries
  injury_status?: 'active' | 'recovering' | 'resolved'
  workout_id?: string
  workout_name?: string
  tags?: string[]
  created_at: string
}

// Constants
const ENTRY_TYPES = [
  { value: 'general', label: 'General', icon: BookOpen, color: 'text-white/60 bg-white/10' },
  { value: 'injury', label: 'Injury', icon: AlertCircle, color: 'text-red-400 bg-red-500/20' },
  { value: 'recovery', label: 'Recovery', icon: Heart, color: 'text-emerald-400 bg-emerald-500/20' },
  { value: 'goal', label: 'Goal', icon: Target, color: 'text-amber-400 bg-amber-500/20' },
  { value: 'milestone', label: 'Milestone', icon: Zap, color: 'text-purple-400 bg-purple-500/20' },
  { value: 'technique', label: 'Technique', icon: Activity, color: 'text-sky-400 bg-sky-500/20' },
]

const BODY_PARTS = [
  'neck', 'shoulder', 'upper_back', 'lower_back', 'chest',
  'bicep', 'tricep', 'forearm', 'wrist', 'hand',
  'hip', 'glute', 'quad', 'hamstring', 'knee', 
  'calf', 'ankle', 'foot',
  'left', 'right', 'both'
]

const SEVERITY_LABELS = [
  { value: 1, label: 'Minor', color: 'bg-yellow-500' },
  { value: 2, label: 'Mild', color: 'bg-orange-400' },
  { value: 3, label: 'Moderate', color: 'bg-orange-500' },
  { value: 4, label: 'Significant', color: 'bg-red-400' },
  { value: 5, label: 'Severe', color: 'bg-red-600' },
]

// Mock data
const MOCK_ENTRIES: JournalEntry[] = [
  {
    id: '1',
    entry_date: '2024-12-28',
    title: 'Left knee discomfort after squats',
    content: 'Noticed some mild discomfort in my left knee during heavy back squats today. Started around the 4th set at 275lbs. The pain was on the medial side, below the kneecap. Going to ice it tonight and reduce squat volume next week. May need to focus on VMO strengthening.',
    entry_type: 'injury',
    body_parts: ['knee', 'left'],
    severity: 2,
    injury_status: 'active',
    workout_id: 'w1',
    workout_name: 'Leg Day - Heavy Squats',
    tags: ['squat', 'form'],
    created_at: '2024-12-28T18:30:00Z',
  },
  {
    id: '2',
    entry_date: '2024-12-26',
    title: 'PR on deadlift!',
    content: 'Finally hit 405lbs on deadlift! Felt smooth and controlled. The extra glute work over the past month really helped with lockout strength. Next goal is 425lbs.',
    entry_type: 'milestone',
    tags: ['deadlift', 'pr', 'strength'],
    created_at: '2024-12-26T17:45:00Z',
  },
  {
    id: '3',
    entry_date: '2024-12-24',
    title: 'Shoulder rehab progress',
    content: 'Third week of external rotation exercises and band pull-aparts. Shoulder feeling much better - no more clicking during overhead press. Will continue the rehab protocol for another 2 weeks before adding volume back.',
    entry_type: 'recovery',
    body_parts: ['shoulder', 'right'],
    injury_status: 'recovering',
    tags: ['shoulder', 'rehab'],
    created_at: '2024-12-24T09:00:00Z',
  },
  {
    id: '4',
    entry_date: '2024-12-20',
    title: 'Q1 2025 Goals',
    content: 'Setting goals for next quarter:\n- Deadlift: 425lbs\n- Squat: 315lbs\n- Bench: 275lbs\n- Run a sub-25 minute 5K\n- Consistent 180g protein daily\n- Maintain body weight around 185lbs',
    entry_type: 'goal',
    tags: ['goals', 'strength', 'running'],
    created_at: '2024-12-20T20:00:00Z',
  },
  {
    id: '5',
    entry_date: '2024-12-15',
    title: 'Hip hinge cue that clicked',
    content: 'Finally found a cue that works for my deadlift setup: "Push the floor away with your legs while pulling your chest up." Keeps my hips from shooting up too fast. Also helpful to think about spreading the floor with my feet for glute activation.',
    entry_type: 'technique',
    tags: ['deadlift', 'cue', 'form'],
    created_at: '2024-12-15T16:30:00Z',
  },
]

// Entry Type Badge
function EntryTypeBadge({ type }: { type: JournalEntry['entry_type'] }) {
  const typeInfo = ENTRY_TYPES.find(t => t.value === type)
  if (!typeInfo) return null
  const Icon = typeInfo.icon

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
      <Icon size={12} />
      {typeInfo.label}
    </span>
  )
}

// Severity Badge
function SeverityBadge({ severity }: { severity: number }) {
  const info = SEVERITY_LABELS.find(s => s.value === severity)
  if (!info) return null

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${info.color} text-white`}>
      {info.label}
    </span>
  )
}

// New Entry Modal
function NewEntryModal({
  onSave,
  onClose,
  editEntry,
}: {
  onSave: (entry: Partial<JournalEntry>) => void
  onClose: () => void
  editEntry?: JournalEntry
}) {
  const [entryType, setEntryType] = useState<JournalEntry['entry_type']>(editEntry?.entry_type || 'general')
  const [title, setTitle] = useState(editEntry?.title || '')
  const [content, setContent] = useState(editEntry?.content || '')
  const [bodyParts, setBodyParts] = useState<string[]>(editEntry?.body_parts || [])
  const [severity, setSeverity] = useState<number>(editEntry?.severity || 2)
  const [injuryStatus, setInjuryStatus] = useState<'active' | 'recovering' | 'resolved'>(editEntry?.injury_status || 'active')
  const [tags, setTags] = useState<string[]>(editEntry?.tags || [])
  const [newTag, setNewTag] = useState('')

  const isInjuryType = entryType === 'injury' || entryType === 'recovery'

  const handleSave = () => {
    onSave({
      entry_type: entryType,
      title,
      content,
      body_parts: isInjuryType ? bodyParts : undefined,
      severity: entryType === 'injury' ? severity : undefined,
      injury_status: isInjuryType ? injuryStatus : undefined,
      tags,
      entry_date: new Date().toISOString().split('T')[0],
    })
    onClose()
  }

  const toggleBodyPart = (part: string) => {
    setBodyParts(prev => 
      prev.includes(part) 
        ? prev.filter(p => p !== part)
        : [...prev, part]
    )
  }

  const addTag = () => {
    if (newTag && !tags.includes(newTag.toLowerCase())) {
      setTags(prev => [...prev, newTag.toLowerCase()])
      setNewTag('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 overflow-y-auto" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl w-full max-w-xl my-8 overflow-hidden border border-white/10 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold">{editEntry ? 'Edit Entry' : 'New Journal Entry'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Entry Type */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {ENTRY_TYPES.map(type => {
                const Icon = type.icon
                return (
                  <button
                    key={type.value}
                    onClick={() => setEntryType(type.value as JournalEntry['entry_type'])}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                      entryType === type.value 
                        ? 'bg-amber-500 text-black' 
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    <Icon size={14} />
                    {type.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief summary..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Notes</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What happened? How does it feel? What's the plan?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none"
              rows={5}
            />
          </div>

          {/* Injury/Recovery specific fields */}
          {isInjuryType && (
            <>
              {/* Body Parts */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Body Part(s)</label>
                <div className="flex flex-wrap gap-1.5">
                  {BODY_PARTS.map(part => (
                    <button
                      key={part}
                      onClick={() => toggleBodyPart(part)}
                      className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                        bodyParts.includes(part)
                          ? 'bg-red-500 text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {part.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity (only for injury) */}
              {entryType === 'injury' && (
                <div>
                  <label className="block text-sm text-white/60 mb-2">Severity</label>
                  <div className="flex gap-2">
                    {SEVERITY_LABELS.map(sev => (
                      <button
                        key={sev.value}
                        onClick={() => setSeverity(sev.value)}
                        className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                          severity === sev.value
                            ? `${sev.color} text-white`
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {sev.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Status</label>
                <div className="flex gap-2">
                  {(['active', 'recovering', 'resolved'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => setInjuryStatus(status)}
                      className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors ${
                        injuryStatus === status
                          ? status === 'resolved' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-black'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span 
                  key={tag}
                  className="px-2 py-1 bg-white/10 rounded text-xs flex items-center gap-1"
                >
                  #{tag}
                  <button 
                    onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                    className="hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Add tag..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={addTag}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  )
}

// Entry Card
function EntryCard({ 
  entry, 
  onEdit,
  onDelete,
}: { 
  entry: JournalEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div 
        className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <EntryTypeBadge type={entry.entry_type} />
              {entry.severity && <SeverityBadge severity={entry.severity} />}
              {entry.injury_status && entry.injury_status !== 'active' && (
                <span className={`px-2 py-0.5 rounded text-xs ${
                  entry.injury_status === 'resolved' 
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {entry.injury_status}
                </span>
              )}
            </div>
            
            {entry.title && (
              <h3 className="font-medium mb-1">{entry.title}</h3>
            )}
            
            <p className={`text-white/60 text-sm ${expanded ? '' : 'line-clamp-2'}`}>
              {entry.content}
            </p>

            {/* Body parts */}
            {entry.body_parts && entry.body_parts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.body_parts.map(part => (
                  <span key={part} className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs capitalize">
                    {part.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.tags.map(tag => (
                  <span key={tag} className="text-xs text-white/40">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className="text-right text-sm text-white/40 flex-shrink-0">
            <p>{new Date(entry.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Expanded actions */}
        {expanded && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            {entry.workout_name && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Activity size={12} />
                {entry.workout_name}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// Main Journal Component
export function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>(MOCK_ENTRIES)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string | null>(null)
  const [filterBodyPart, setFilterBodyPart] = useState<string | null>(null)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    // Search
    const searchMatch = !search || 
      entry.title?.toLowerCase().includes(search.toLowerCase()) ||
      entry.content.toLowerCase().includes(search.toLowerCase()) ||
      entry.tags?.some(t => t.includes(search.toLowerCase())) ||
      entry.body_parts?.some(bp => bp.includes(search.toLowerCase()))

    // Type filter
    const typeMatch = !filterType || entry.entry_type === filterType

    // Body part filter
    const bodyPartMatch = !filterBodyPart || entry.body_parts?.includes(filterBodyPart)

    return searchMatch && typeMatch && bodyPartMatch
  })

  // Count active injuries
  const activeInjuries = entries.filter(e => 
    e.entry_type === 'injury' && e.injury_status === 'active'
  ).length

  const handleSaveEntry = (entryData: Partial<JournalEntry>) => {
    if (editingEntry) {
      setEntries(prev => prev.map(e => 
        e.id === editingEntry.id ? { ...e, ...entryData } : e
      ))
    } else {
      const newEntry: JournalEntry = {
        id: `entry-${Date.now()}`,
        entry_date: entryData.entry_date || new Date().toISOString().split('T')[0],
        title: entryData.title,
        content: entryData.content || '',
        entry_type: entryData.entry_type || 'general',
        body_parts: entryData.body_parts,
        severity: entryData.severity,
        injury_status: entryData.injury_status,
        tags: entryData.tags,
        created_at: new Date().toISOString(),
      }
      setEntries(prev => [newEntry, ...prev])
    }
    setEditingEntry(null)
  }

  const handleDeleteEntry = (id: string) => {
    if (confirm('Delete this entry?')) {
      setEntries(prev => prev.filter(e => e.id !== id))
    }
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold">Journal</h1>
          <p className="text-white/50">
            {entries.length} entries
            {activeInjuries > 0 && (
              <span className="text-red-400 ml-2">• {activeInjuries} active injuries</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowNewEntry(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          New Entry
        </button>
      </div>

      {/* Search and filters */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries, body parts, tags..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showFilters || filterType || filterBodyPart
                ? 'bg-amber-500 text-black'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="glass rounded-lg p-4 space-y-3">
            {/* Type filter */}
            <div>
              <label className="block text-xs text-white/40 mb-2">Entry Type</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterType(null)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    !filterType ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  All
                </button>
                {ENTRY_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setFilterType(filterType === type.value ? null : type.value)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      filterType === type.value ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body part filter */}
            <div>
              <label className="block text-xs text-white/40 mb-2">Body Part</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterBodyPart(null)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    !filterBodyPart ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  All
                </button>
                {BODY_PARTS.filter(p => !['left', 'right', 'both'].includes(p)).map(part => (
                  <button
                    key={part}
                    onClick={() => setFilterBodyPart(filterBodyPart === part ? null : part)}
                    className={`px-2.5 py-1 rounded text-xs capitalize transition-colors ${
                      filterBodyPart === part ? 'bg-amber-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {part.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {filteredEntries.map(entry => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onEdit={() => {
              setEditingEntry(entry)
              setShowNewEntry(true)
            }}
            onDelete={() => handleDeleteEntry(entry.id)}
          />
        ))}

        {filteredEntries.length === 0 && (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/40">No entries found</p>
            {search && (
              <p className="text-sm text-white/30 mt-1">Try a different search term</p>
            )}
          </div>
        )}
      </div>

      {/* New/Edit Entry Modal */}
      {showNewEntry && (
        <NewEntryModal
          onSave={handleSaveEntry}
          onClose={() => {
            setShowNewEntry(false)
            setEditingEntry(null)
          }}
          editEntry={editingEntry || undefined}
        />
      )}
    </div>
  )
}
