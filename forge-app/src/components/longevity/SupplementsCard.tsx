'use client'

import { useState } from 'react'
import {
  Pill,
  Plus,
  ChevronRight,
  Info,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { Supplement, SupplementCategory } from '@/types/longevity'
import { format, parseISO } from 'date-fns'

interface SupplementsCardProps {
  supplements: Supplement[]
  onRefresh?: () => void
}

const CATEGORY_COLORS: Record<SupplementCategory, string> = {
  vitamin: 'bg-yellow-500/20 text-yellow-400',
  mineral: 'bg-gray-500/20 text-gray-400',
  amino_acid: 'bg-blue-500/20 text-blue-400',
  herb: 'bg-green-500/20 text-green-400',
  hormone: 'bg-pink-500/20 text-pink-400',
  prescription: 'bg-red-500/20 text-red-400',
  other: 'bg-white/10 text-white/60',
}

export function SupplementsCard({
  supplements,
  onRefresh,
}: SupplementsCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // New supplement form
  const [newName, setNewName] = useState('')
  const [newDosage, setNewDosage] = useState('')
  const [newCategory, setNewCategory] = useState<SupplementCategory>('vitamin')
  const [newFrequency, setNewFrequency] = useState('daily')

  const activeSupplements = supplements.filter(s => s.is_active)

  const handleAddSupplement = async () => {
    if (!newName) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/supplements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          dosage: newDosage || null,
          category: newCategory,
          frequency: newFrequency,
          is_active: true,
          start_date: new Date().toISOString().split('T')[0],
        }),
      })

      if (!response.ok) throw new Error('Failed to add')

      setNewName('')
      setNewDosage('')
      setShowAddForm(false)
      onRefresh?.()
    } catch (error) {
      console.error('Error adding supplement:', error)
      alert('Failed to add. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await fetch('/api/supplements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          is_active: !currentActive,
          end_date: !currentActive ? null : new Date().toISOString().split('T')[0],
        }),
      })
      onRefresh?.()
    } catch (error) {
      console.error('Error updating supplement:', error)
    }
  }

  return (
    <div className="glass rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-500/20 rounded-lg">
            <Pill size={18} className="text-teal-400" />
          </div>
          <div>
            <h3 className="font-medium">Supplements</h3>
            <p className="text-xs text-white/50">{activeSupplements.length} active</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 hover:bg-white/10 rounded-lg"
          >
            <Info size={16} className="text-white/40" />
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 hover:bg-white/10 rounded-lg"
          >
            <Plus size={16} className="text-white/40" />
          </button>
        </div>
      </div>

      {/* Info tooltip */}
      {showInfo && (
        <div className="mb-3 p-3 bg-white/5 rounded-lg text-xs text-white/60">
          Track your supplement stack and medication compliance.
          Evidence-based supplements for longevity often include Vitamin D, Omega-3s, Creatine, and Magnesium.
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="mb-3 p-3 bg-white/5 rounded-lg space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Supplement name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newDosage}
              onChange={(e) => setNewDosage(e.target.value)}
              placeholder="Dosage (e.g., 500mg)"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as SupplementCategory)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="vitamin">Vitamin</option>
              <option value="mineral">Mineral</option>
              <option value="amino_acid">Amino Acid</option>
              <option value="herb">Herb</option>
              <option value="hormone">Hormone</option>
              <option value="prescription">Prescription</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSupplement}
              disabled={!newName || isSubmitting}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Supplement list */}
      {activeSupplements.length > 0 ? (
        <div className="space-y-2">
          {activeSupplements.slice(0, 6).map(supplement => (
            <div
              key={supplement.id}
              className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs ${CATEGORY_COLORS[supplement.category || 'other']}`}>
                  {supplement.category || 'other'}
                </span>
                <div>
                  <p className="text-sm font-medium">{supplement.name}</p>
                  {supplement.dosage && (
                    <p className="text-xs text-white/40">{supplement.dosage} • {supplement.frequency}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleToggleActive(supplement.id, supplement.is_active)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X size={14} className="text-white/30 hover:text-red-400" />
              </button>
            </div>
          ))}
          {activeSupplements.length > 6 && (
            <p className="text-xs text-white/40 text-center">
              +{activeSupplements.length - 6} more
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-white/40 text-sm">
          <Pill size={24} className="mx-auto mb-1 opacity-50" />
          <p>No supplements tracked</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-amber-400 hover:text-amber-300 text-xs mt-1"
          >
            Add your first supplement
          </button>
        </div>
      )}
    </div>
  )
}
