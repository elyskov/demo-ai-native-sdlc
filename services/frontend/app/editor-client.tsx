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
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Popover,
  PopoverAnchor,
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
  const [editPopoverPoint, setEditPopoverPoint] = useState<{ x: number; y: number } | null>(null)
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
    if (!entityToDelete) {
      setEditPopoverOpen(false)
      return
    }

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
    <div className="flex flex-col min-h-full bg-background">

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <div className="container max-w-4xl mx-auto py-8 px-4 min-h-[calc(100vh-120px)] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">{diagram.name}</h1>
            <Button onClick={() => router.push('/')}
              className="inline-flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {/* Mermaid Display Area */}
            <Popover open={editPopoverOpen} onOpenChange={setEditPopoverOpen}>
              <div className="relative w-full h-[60vh]">
                {editPopoverPoint && (
                  <PopoverAnchor asChild>
                    <span
                      style={{
                        position: 'absolute',
                        left: editPopoverPoint.x,
                        top: editPopoverPoint.y,
                        width: 1,
                        height: 1,
                      }}
                    />
                  </PopoverAnchor>
                )}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <PopoverTrigger asChild>
                      <div
                        ref={contextMenuRef}
                        onClick={(event) => {
                          const rect = contextMenuRef.current?.getBoundingClientRect()
                          if (rect) {
                            const margin = 16
                            const x = Math.min(Math.max(event.clientX - rect.left, margin), rect.width - margin)
                            const y = Math.min(Math.max(event.clientY - rect.top, margin), rect.height - margin)
                            setEditPopoverPoint({ x, y })
                          }
                          setSelectedElement({ entity: 'region', name: 'Selected Element' })
                          setEditPopoverOpen(true)
                        }}
                        className="bg-card border-2 border-dashed border-muted rounded-lg p-8 h-full font-mono text-sm whitespace-pre-wrap break-words text-card-foreground select-text cursor-pointer w-full"
                      >
                        {diagram.content}
                      </div>
                    </PopoverTrigger>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem
                    onClick={() => {
                      setSelectedElement({ entity: 'region', name: 'New Region' })
                      setEditPopoverOpen(false)
                      handleOpenAddPopover()
                    }}
                  >
                    Region
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setSelectedElement({ entity: 'site', name: 'New Site' })
                      setEditPopoverOpen(false)
                      handleOpenAddPopover()
                    }}
                  >
                    Site
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setSelectedElement({ entity: 'container', name: 'New Container' })
                      setEditPopoverOpen(false)
                      handleOpenAddPopover()
                    }}
                  >
                    Container
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setSelectedElement({ entity: 'node', name: 'New Node' })
                      setEditPopoverOpen(false)
                      handleOpenAddPopover()
                    }}
                  >
                    Deployment Node
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

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
                  const rect = contextMenuRef.current?.getBoundingClientRect()
                  if (rect) {
                    setEditPopoverPoint({ x: rect.width / 2, y: rect.height / 2 })
                  }
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
              </div>
              <PopoverContent
                className="w-80"
                align="start"
                sideOffset={12}
                collisionPadding={16}
                collisionBoundary={contextMenuRef.current ?? undefined}
              >
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
          </div>

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
