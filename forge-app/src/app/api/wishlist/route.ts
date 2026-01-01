import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { promises as fs } from 'fs'
import path from 'path'

const WISHLIST_PATH = path.join(process.cwd(), 'WISHLIST.md')

// GET /api/wishlist - Read current wishlist
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const content = await fs.readFile(WISHLIST_PATH, 'utf-8')
      return NextResponse.json({ content })
    } catch {
      return NextResponse.json({ content: '# FORGE App - Wishlist & Bug Fixes\n\n## Wishlist\n\n## Bug Reports\n' })
    }
  } catch (error) {
    console.error('Wishlist GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/wishlist - Add item to wishlist
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { item, category = 'wishlist' } = body

    if (!item || typeof item !== 'string') {
      return NextResponse.json({ error: 'Item is required' }, { status: 400 })
    }

    // Read current content
    let content: string
    try {
      content = await fs.readFile(WISHLIST_PATH, 'utf-8')
    } catch {
      content = `# FORGE App - Wishlist & Bug Fixes

## In Progress
<!-- Add current work items here -->

## Completed
<!-- Completed items will be moved here -->

## Wishlist (Future Features)
<!-- Add new feature ideas here -->

## Bug Reports
<!-- Add bug reports here -->

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`
    }

    // Find the right section to add to
    const sectionMap: Record<string, string> = {
      wishlist: '## Wishlist (Future Features)',
      bug: '## Bug Reports',
      'in_progress': '## In Progress',
    }

    const sectionHeader = sectionMap[category] || sectionMap.wishlist
    const newItem = `- [ ] ${item}`

    // Insert the item after the section header
    const sectionIndex = content.indexOf(sectionHeader)
    if (sectionIndex === -1) {
      // Section doesn't exist, append at end
      content = content.trim() + `\n\n${sectionHeader}\n${newItem}\n`
    } else {
      // Find the end of the header line
      const headerEndIndex = content.indexOf('\n', sectionIndex)
      // Find the next section or end
      const nextSectionMatch = content.slice(headerEndIndex + 1).match(/\n## /)
      const insertPosition = nextSectionMatch
        ? headerEndIndex + 1 + (nextSectionMatch.index || 0)
        : content.length

      // Find where to insert (after any existing items or comment)
      let insertAt = headerEndIndex + 1
      const sectionContent = content.slice(headerEndIndex + 1, insertPosition)
      const lines = sectionContent.split('\n')

      // Find first non-empty, non-comment line position to insert after existing items
      let lastItemIndex = 0
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('- ')) {
          lastItemIndex = i + 1
        }
      }

      // Calculate actual insert position
      const linesBeforeInsert = lines.slice(0, lastItemIndex || 1)
      insertAt = headerEndIndex + 1 + linesBeforeInsert.join('\n').length + (lastItemIndex > 0 ? 1 : 0)

      // Insert the new item
      const prefix = content.slice(0, insertAt)
      const suffix = content.slice(insertAt)

      // Add newline if needed
      const needsNewline = !prefix.endsWith('\n')
      content = prefix + (needsNewline ? '\n' : '') + newItem + '\n' + suffix.replace(/^\n+/, '')
    }

    // Update last updated date
    content = content.replace(/\*Last updated: .*\*/, `*Last updated: ${new Date().toISOString().split('T')[0]}*`)

    // Write back
    await fs.writeFile(WISHLIST_PATH, content, 'utf-8')

    return NextResponse.json({
      success: true,
      message: `Added to ${category}: "${item}"`,
    })
  } catch (error) {
    console.error('Wishlist POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
