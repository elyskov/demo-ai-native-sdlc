"use client"

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Plus, Trash2, Move } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Diagram = {
  id: string
  name: string
  content: string
}

type DiagramEditorProps = {
  diagram: Diagram
}

type EntityType = {
  id?: string
  entity?: string
  name?: string
}

type EntityAttribute = {
  key: string
  value: string
}

// Fixed infrastructure root context for all operations
const FIXED_CONTEXT = {
  entity: 'infrastructure',
  parent: { root: 'infrastructure' },
}

export function DiagramEditor({ diagram }: DiagramEditorProps) {
  const router = useRouter()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState<string | null>(null)
  const [editPopoverOpen, setEditPopoverOpen] = useState(false)
  const [addPopoverOpen, setAddPopoverOpen] = useState(false)
  const [movePopoverOpen, setMovePopoverOpen] = useState(false)
  const [selectedElement, setSelectedElement] = useState<EntityType | null>(null)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [childElements, setChildElements] = useState<EntityType[]>([])
  const [attributes, setAttributes] = useState<EntityAttribute[]>([
    { key: 'name', value: '' },
  ])
  const [targetElement, setTargetElement] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Load entity types when add popover opens
  const handleOpenAddPopover = async () => {
    setAddPopoverOpen(true)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'list-types',
            entity: FIXED_CONTEXT.entity,
            parent: FIXED_CONTEXT.parent,
          }),
        }
      )

      if (res.ok) {
        const data = (await res.json()) as { types: string[] }
        setEntityTypes(data.types)
      }
    } catch (error) {
      console.error('Failed to load entity types:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load child elements when move popover opens
  const handleOpenMovePopover = async () => {
    setMovePopoverOpen(true)
    setLoading(true)
    try {
      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'list-elements',
            entity: FIXED_CONTEXT.entity,
            parent: FIXED_CONTEXT.parent,
          }),
        }
      )

      if (res.ok) {
        const data = (await res.json()) as { elements: EntityType[] }
        setChildElements(data.elements)
      }
    } catch (error) {
      console.error('Failed to load elements:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEntity = async () => {
    if (!selectedElement) return

    setLoading(true)
    try {
      const attrs: Record<string, string> = {}
      for (const { key, value } of attributes) {
        if (value.trim()) {
          attrs[key] = value.trim()
        }
      }

      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'create',
            entity: selectedElement,
            parent: FIXED_CONTEXT.parent,
            attributes: attrs,
          }),
        }
      )

      if (!res.ok) {
        throw new Error(`Failed to create entity (${res.status})`)
      }

      router.refresh()
      setAddPopoverOpen(false)
      setSelectedElement(null)
      setAttributes([{ key: 'name', value: '' }])
    } catch (error) {
      console.error('Failed to create entity:', error)
      alert('Failed to create entity')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEntity = async () => {
    if (!entityToDelete) return

    setLoading(true)
    try {
      const attrs: Record<string, string> = {}
      for (const { key, value } of attributes) {
        if (value.trim()) {
          attrs[key] = value.trim()
        }
      }

      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'update',
            entity: selectedElement?.entity || 'site',
            id: entityToDelete,
            parent: FIXED_CONTEXT.parent,
            attributes: attrs,
          }),
        }
      )

      if (!res.ok) {
        throw new Error(`Failed to update entity (${res.status})`)
      }

      router.refresh()
      setEditPopoverOpen(false)
      setEntityToDelete(null)
      setAttributes([{ key: 'name', value: '' }])
    } catch (error) {
      console.error('Failed to update entity:', error)
      alert('Failed to update entity')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEntity = async () => {
    if (!entityToDelete || !selectedElement) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'delete',
            entity: selectedElement.entity || 'site',
            id: entityToDelete,
            parent: FIXED_CONTEXT.parent,
          }),
        }
      )

      if (!res.ok) {
        throw new Error(`Failed to delete entity (${res.status})`)
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to delete entity:', error)
      alert('Failed to delete entity')
    } finally {
      setLoading(false)
      setDeleteDialogOpen(false)
      setEntityToDelete(null)
    }
  }

  const handleMoveEntity = async () => {
    if (!entityToDelete || !selectedElement || !targetElement) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'move',
            entity: selectedElement.entity || 'site',
            id: entityToDelete,
            parent: FIXED_CONTEXT.parent,
          }),
        }
      )

      if (!res.ok) {
        throw new Error(`Failed to move entity (${res.status})`)
      }

      router.refresh()
      setMovePopoverOpen(false)
      setEntityToDelete(null)
      setTargetElement('')
    } catch (error) {
      console.error('Failed to move entity:', error)
      alert('Failed to move entity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{diagram.name}</h1>
            <p className="text-sm text-muted-foreground">{diagram.id}</p>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Mermaid Display Area */}
          <ContextMenu>
            <div
              ref={contextMenuRef}
              className="bg-card border-2 border-dashed border-muted rounded-lg p-8 min-h-96 font-mono text-sm whitespace-pre-wrap break-words text-card-foreground select-text"
            >
              {diagram.content}
            </div>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => {
                  setSelectedElement({ entity: 'region', name: 'New Region' })
                  setEditPopoverOpen(false)
                  handleOpenAddPopover()
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add
              </ContextMenuItem>

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Move className="mr-2 h-4 w-4" />
                  Move
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem disabled>
                    <span className="text-xs text-muted-foreground">
                      Select a target element
                    </span>
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => {
                  setSelectedElement({ entity: 'site', name: 'Edit' })
                  setEditPopoverOpen(true)
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Selected
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  setDeleteDialogOpen(true)
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Instructions */}
          <p className="text-sm text-muted-foreground mt-4 italic">
            Right-click on the diagram area above to add or manage elements.
            All operations use the fixed infrastructure context.
          </p>
        </div>
      </div>

      {/* Add Entity Popover */}
      <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Add New Entity</h4>
              <p className="text-sm text-muted-foreground">
                Create a new infrastructure element
              </p>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="entity-type">Entity Type</Label>
                <select
                  id="entity-type"
                  value={selectedElement?.entity || ''}
                  onChange={(e) => {
                    setSelectedElement({
                      ...selectedElement,
                      entity: e.target.value,
                    })
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">Select a type...</option>
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Attributes</Label>
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={attr.key}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[idx].key = e.target.value
                        setAttributes(newAttrs)
                      }}
                      disabled={loading}
                    />
                    <Input
                      placeholder="Value"
                      value={attr.value}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[idx].value = e.target.value
                        setAttributes(newAttrs)
                      }}
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAttributes([
                    ...attributes,
                    { key: '', value: '' },
                  ])
                }}
                disabled={loading}
              >
                + Add Attribute
              </Button>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddPopoverOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateEntity}
                disabled={loading || !selectedElement?.entity}
              >
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Edit Entity Popover */}
      <Popover open={editPopoverOpen} onOpenChange={setEditPopoverOpen}>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Edit Entity</h4>
              <p className="text-sm text-muted-foreground">
                Update entity attributes
              </p>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Attributes</Label>
                {attributes.map((attr, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Key"
                      value={attr.key}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[idx].key = e.target.value
                        setAttributes(newAttrs)
                      }}
                      disabled={loading}
                    />
                    <Input
                      placeholder="Value"
                      value={attr.value}
                      onChange={(e) => {
                        const newAttrs = [...attributes]
                        newAttrs[idx].value = e.target.value
                        setAttributes(newAttrs)
                      }}
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditPopoverOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleUpdateEntity}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Move Entity Popover */}
      <Popover open={movePopoverOpen} onOpenChange={setMovePopoverOpen}>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Move Entity</h4>
              <p className="text-sm text-muted-foreground">
                Move entity to a new parent
              </p>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="target-element">Target Parent</Label>
                <select
                  id="target-element"
                  value={targetElement}
                  onChange={(e) => setTargetElement(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={loading}
                >
                  <option value="">Select a parent...</option>
                  {childElements.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.name} ({el.entity})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMovePopoverOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleMoveEntity}
                disabled={loading || !targetElement}
              >
                {loading ? 'Moving...' : 'Move'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntity}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
