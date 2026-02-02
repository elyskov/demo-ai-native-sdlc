"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Plus, Trash2, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

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
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MermaidViewer, type MermaidViewerHandle } from '@/components/mermaid-viewer'
import { parseMermaidDomainRef } from '@/lib/mermaid-id'

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

type SelectedDomainRef = {
  mermaidId: string
  entity: string
  id: string
}

type GetElementResponse = {
  entity: string
  id: string
  attributes: Record<string, any>
  parent?: any
  attributeOrder?: string[]
}

type EntityTypeDetails = {
  attributes: string[]
  requiredAttributes: string[]
}

type CreateParentRef =
  | { root: 'definitions' | 'infrastructure' }
  | { entity: string; id: string }

const DEFAULT_ROOT_PARENT: CreateParentRef = { root: 'infrastructure' }

type ListElementsResponse = {
  elements: EntityType[]
  roots?: Array<{ root: 'definitions' | 'infrastructure'; name: string }>
}

export function DiagramEditor({ diagram }: DiagramEditorProps) {
  const router = useRouter()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const mermaidViewerRef = useRef<MermaidViewerHandle>(null)
  const slugTouchedRef = useRef(false)
  const slugAutoRef = useRef('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editPopoverOpen, setEditPopoverOpen] = useState(false)
  const [addPopoverOpen, setAddPopoverOpen] = useState(false)
  const [selectedElement, setSelectedElement] = useState<SelectedDomainRef | null>(null)
  const selectedElementRef = useRef<SelectedDomainRef | null>(null)
  const [createEntityType, setCreateEntityType] = useState<string>('')
  const [addPopoverPoint, setAddPopoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [editPopoverPoint, setEditPopoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [entityTypeDetails, setEntityTypeDetails] = useState<Record<string, EntityTypeDetails>>({})
  const [childElements, setChildElements] = useState<EntityType[]>([])
  const [moveRoots, setMoveRoots] = useState<Array<{ root: 'definitions' | 'infrastructure'; name: string }>>([])
  const [createParent, setCreateParent] = useState<CreateParentRef>(DEFAULT_ROOT_PARENT)
  const [attributes, setAttributes] = useState<EntityAttribute[]>([
    { key: 'name', value: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addErrorMessage, setAddErrorMessage] = useState<string | null>(null)

  const [entityTypesLoaded, setEntityTypesLoaded] = useState(false)
  const [moveTargetsLoaded, setMoveTargetsLoaded] = useState(false)

  useEffect(() => {
    selectedElementRef.current = selectedElement
  }, [selectedElement])

  const moveTargets = useMemo(() => {
    const roots = (moveRoots ?? []).map((r) => ({ id: r.root, entity: 'root', name: r.name }))
    return [...roots, ...childElements]
  }, [childElements, moveRoots])

  const setPointFromClient = (clientX: number, clientY: number) => {
    const rect = contextMenuRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 16
    const x = Math.min(Math.max(clientX - rect.left, margin), rect.width - margin)
    const y = Math.min(Math.max(clientY - rect.top, margin), rect.height - margin)
    setEditPopoverPoint({ x, y })
  }

  const parentRefFromSelection = (sel: SelectedDomainRef | null): CreateParentRef => {
    if (!sel) return DEFAULT_ROOT_PARENT
    if (sel.entity === 'root') {
      return { root: sel.id === 'definitions' ? 'definitions' : 'infrastructure' }
    }
    return { entity: sel.entity, id: sel.id }
  }

  const loadEntityTypes = async (parent: CreateParentRef) => {
    setEntityTypesLoaded(false)
    setEntityTypes([])
    setEntityTypeDetails({})

    try {
      const res = await fetch(`/api/diagrams/${diagram.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'list-types',
          entity: 'infrastructure',
          parent,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to load entity types (${res.status})`)
      }

      const data = (await res.json()) as { types: string[]; details?: Record<string, EntityTypeDetails> }
      setEntityTypes(data.types)
      if (data.details && typeof data.details === 'object') {
        setEntityTypeDetails(data.details)
      }
      setEntityTypesLoaded(true)
    } catch (error) {
      console.error('Failed to load entity types:', error)
      setErrorMessage('Failed to load entity types')
      setEntityTypesLoaded(true)
    }
  }

  const ensureAttributesForEntityType = (entityType: string, current: EntityAttribute[]) => {
    const details = entityTypeDetails[entityType]
    if (!details) return current

    const byKey = new Map<string, string>()
    for (const { key, value } of current) {
      const k = key.trim()
      if (!k) continue
      byKey.set(k, value)
    }

    const orderedKeys = Array.from(new Set([...(details.attributes ?? []), ...(details.requiredAttributes ?? [])]))
    const next: EntityAttribute[] = []

    for (const key of orderedKeys) {
      if (details.requiredAttributes.includes(key) || byKey.has(key)) {
        next.push({ key, value: byKey.get(key) ?? '' })
        byKey.delete(key)
      }
    }

    for (const [key, value] of byKey.entries()) {
      next.push({ key, value })
    }

    return next.length ? next : current
  }

  const slugify = (value: string) => {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const parseApiErrorMessage = async (res: Response) => {
    try {
      const data = await res.json()
      const msg = (data as any)?.message
      if (Array.isArray(msg)) return msg.join('\n')
      if (typeof msg === 'string') return msg
    } catch {
      // ignore
    }
    return `Request failed (${res.status})`
  }

  const getAttributeValue = (list: EntityAttribute[], key: string) => {
    const found = list.find((a) => a.key.trim() === key)
    return found?.value ?? ''
  }

  const applyAttributeUpdates = (
    entityType: string,
    updates: Record<string, string>,
  ) => {
    setAttributes((current) => {
      const next = current.map((a) => {
        const k = a.key.trim()
        if (!k) return a
        if (Object.prototype.hasOwnProperty.call(updates, k)) {
          return { ...a, value: updates[k] }
        }
        return a
      })

      for (const [k, v] of Object.entries(updates)) {
        if (!next.some((a) => a.key.trim() === k)) {
          next.push({ key: k, value: v })
        }
      }

      return ensureAttributesForEntityType(entityType, next)
    })
  }

  const handleNameValueChange = (entityType: string, nextName: string) => {
    const updates: Record<string, string> = { name: nextName }

    const details = entityTypeDetails[entityType]
    const hasSlugField = Boolean(
      details?.attributes?.includes('slug') ||
      details?.requiredAttributes?.includes('slug') ||
      attributes.some((a) => a.key.trim() === 'slug')
    )

    if (!slugTouchedRef.current && hasSlugField) {
      const nextSlug = slugify(nextName)
      slugAutoRef.current = nextSlug
      updates.slug = nextSlug
    }

    applyAttributeUpdates(entityType, updates)
  }

  const handleSlugValueChange = (entityType: string, nextSlug: string) => {
    slugTouchedRef.current = true
    slugAutoRef.current = ''
    applyAttributeUpdates(entityType, { slug: nextSlug })
  }

  const loadMoveTargets = async (sel: SelectedDomainRef) => {
    if (sel.entity === 'root') {
      setChildElements([])
      setMoveRoots([])
      setMoveTargetsLoaded(true)
      return
    }

    setMoveTargetsLoaded(false)
    setChildElements([])
    setMoveRoots([])

    try {
      const res = await fetch(`/api/diagrams/${diagram.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'list-elements',
          entity: sel.entity,
          id: sel.id,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to load elements (${res.status})`)
      }

      const data = (await res.json()) as ListElementsResponse
      setChildElements(Array.isArray(data.elements) ? data.elements : [])
      setMoveRoots(Array.isArray(data.roots) ? data.roots : [])
      setMoveTargetsLoaded(true)
    } catch (error) {
      console.error('Failed to load elements:', error)
      setErrorMessage('Failed to load move targets')
      setMoveTargetsLoaded(true)
    }
  }

  const refreshMenuData = () => {
    const sel = selectedElementRef.current
    void loadEntityTypes(parentRefFromSelection(sel))
    if (sel && sel.entity !== 'root') {
      void loadMoveTargets(sel)
    } else {
      setChildElements([])
      setMoveRoots([])
      setMoveTargetsLoaded(true)
    }
  }

  useEffect(() => {
    // Keep menu options in sync with the current selection context.
    const sel = selectedElement
    void loadEntityTypes(parentRefFromSelection(sel))

    if (sel && sel.entity !== 'root') {
      void loadMoveTargets(sel)
    } else {
      setChildElements([])
      setMoveRoots([])
      setMoveTargetsLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram.id, selectedElement?.entity, selectedElement?.id])

  const loadSelectedElementContext = async (ref: SelectedDomainRef) => {
    if (ref.entity === 'root') {
      // Default diagram roots are not stored as domain objects.
      setAttributes([])
      return
    }

    try {
      const res = await fetch(`/api/diagrams/${diagram.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'get-element',
          entity: ref.entity,
          id: ref.id,
          parent: DEFAULT_ROOT_PARENT,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to load element (${res.status})`)
      }

      const data = (await res.json()) as GetElementResponse
      const order = Array.isArray(data.attributeOrder) ? data.attributeOrder : Object.keys(data.attributes ?? {}).sort()
      const next = order.map((key) => ({ key, value: data.attributes?.[key] == null ? '' : String(data.attributes[key]) }))
      const ensured = ensureAttributesForEntityType(ref.entity, next.length ? next : [{ key: 'name', value: '' }])

      // Determine whether slug should follow name automatically.
      const currentName = String(getAttributeValue(ensured, 'name') ?? '')
      const currentSlug = String(getAttributeValue(ensured, 'slug') ?? '')
      const auto = slugify(currentName)
      slugAutoRef.current = auto
      slugTouchedRef.current = Boolean(currentSlug && currentSlug !== auto)

      setAttributes(ensured)
    } catch (error) {
      console.error('Failed to load selected element context:', error)
      setErrorMessage('Failed to load selected element')
      // Keep previous attribute inputs if fetch fails.
    }
  }

  const openAddPopoverWithType = async (entityType: string) => {
    setErrorMessage(null)
    setAddErrorMessage(null)
    setCreateEntityType(entityType)
    slugTouchedRef.current = false
    slugAutoRef.current = ''

    // Use current selection as parent when available.
    const current = selectedElementRef.current
    if (current) {
      if (current.entity === 'root') {
        const root = current.id === 'definitions' ? 'definitions' : 'infrastructure'
        setCreateParent({ root })
      } else {
        setCreateParent({ entity: current.entity, id: current.id })
      }
    } else {
      setCreateParent(DEFAULT_ROOT_PARENT)
    }

    setAttributes(ensureAttributesForEntityType(entityType, [{ key: 'name', value: '' }]))

    // Anchor the "Add" popover near the diagram area (Popover needs an anchor/trigger).
    const rect = contextMenuRef.current?.getBoundingClientRect()
    if (rect) {
      setAddPopoverPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    } else {
      setAddPopoverPoint({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    }

    // IMPORTANT:
    // This function is called from a Radix ContextMenuItem handler.
    // Opening a Popover in the same pointer interaction can cause it to instantly close
    // (the click is interpreted as "outside"), and can briefly position at (0,0) before
    // the anchor is mounted.
    // Defer to the next tick so the context menu closes first and the anchor is present.
    setAddPopoverOpen(false)
    window.setTimeout(() => setAddPopoverOpen(true), 0)

    // Ensure types are loaded for the current parent context (best-effort).
    void loadEntityTypes(parentRefFromSelection(selectedElementRef.current))
  }

  const handleCreateEntity = async () => {
    if (!createEntityType) return

    setLoading(true)
    setAddErrorMessage(null)
    try {
      const attrs: Record<string, string> = {}
      for (const { key, value } of attributes) {
        const k = key.trim()
        const v = value.trim()
        if (k && v) {
          attrs[k] = v
        }
      }

      const required = new Set(entityTypeDetails[createEntityType]?.requiredAttributes ?? [])
      if (required.has('slug') && !attrs.slug && typeof attrs.name === 'string' && attrs.name.trim()) {
        const s = slugify(attrs.name)
        if (s) attrs.slug = s
      }
      if (required.has('status') && !attrs.status) {
        attrs.status = 'active'
      }

      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'create',
            entity: createEntityType,
            parent: createParent,
            attributes: attrs,
          }),
        }
      )

      if (!res.ok) {
        const msg = await parseApiErrorMessage(res)
        throw new Error(msg)
      }

      router.refresh()
      setAddPopoverOpen(false)
      setCreateEntityType('')
      setCreateParent(DEFAULT_ROOT_PARENT)
      setAttributes([{ key: 'name', value: '' }])
      refreshMenuData()
    } catch (error) {
      console.error('Failed to create entity:', error)
      setAddErrorMessage(error instanceof Error ? error.message : 'Failed to create entity')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateEntity = async () => {
    const current = selectedElementRef.current
    if (!current || current.entity === 'root') {
      setEditPopoverOpen(false)
      return
    }

    setLoading(true)
    try {
      const attrs: Record<string, string> = {}
      for (const { key, value } of attributes) {
        const k = key.trim()
        const v = value.trim()
        if (k && v) {
          attrs[k] = v
        }
      }

      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'update',
            entity: current.entity,
            id: current.id,
            parent: DEFAULT_ROOT_PARENT,
            attributes: attrs,
          }),
        }
      )

      if (!res.ok) {
        const msg = await parseApiErrorMessage(res)
        throw new Error(msg)
      }

      router.refresh()
      setEditPopoverOpen(false)
      setAttributes([{ key: 'name', value: '' }])
      refreshMenuData()
    } catch (error) {
      console.error('Failed to update entity:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update entity')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEntity = async () => {
    const current = selectedElementRef.current
    if (!current || current.entity === 'root') return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/diagrams/${diagram.id}/commands`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'delete',
            entity: current.entity,
            id: current.id,
            parent: DEFAULT_ROOT_PARENT,
          }),
        }
      )

      if (!res.ok) {
        throw new Error(`Failed to delete entity (${res.status})`)
      }

      router.refresh()
      refreshMenuData()
    } catch (error) {
      console.error('Failed to delete entity:', error)
      setErrorMessage('Failed to delete entity')
    } finally {
      setLoading(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleMoveEntity = async (target: { entity: string; id: string } | { root: 'infrastructure' | 'definitions' }) => {
    const current = selectedElementRef.current
    if (!current || current.entity === 'root') return

    setLoading(true)
    try {
      const parent = 'root' in target ? { root: target.root } : { entity: target.entity, id: target.id }

      const res = await fetch(`/api/diagrams/${diagram.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'move',
          entity: current.entity,
          id: current.id,
          parent,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to move entity (${res.status})`)
      }

      router.refresh()
      refreshMenuData()
    } catch (error) {
      console.error('Failed to move entity:', error)
      setErrorMessage('Failed to move entity')
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
                <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Reset view"
                    onClick={(e) => {
                      e.stopPropagation()
                      mermaidViewerRef.current?.resetView()
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Zoom out"
                    onClick={(e) => {
                      e.stopPropagation()
                      mermaidViewerRef.current?.zoomOut()
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Zoom in"
                    onClick={(e) => {
                      e.stopPropagation()
                      mermaidViewerRef.current?.zoomIn()
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
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
                    <div
                      ref={contextMenuRef}
                      className="bg-card border-2 border-border rounded-lg p-2 h-full text-card-foreground select-text w-full overflow-hidden"
                    >
                      <MermaidViewer
                        ref={mermaidViewerRef}
                        code={diagram.content}
                        className="h-full w-full"
                        fallbackClassName="h-full w-full overflow-auto p-4 font-mono text-sm whitespace-pre-wrap break-words"
                        ariaLabel="Diagram preview"
                        onElementEvent={(ev) => {
                          setErrorMessage(null)

                          const parsed = parseMermaidDomainRef(ev.mermaidId)
                          if (!parsed) return

                          const nextSel: SelectedDomainRef = {
                            mermaidId: ev.mermaidId,
                            entity: parsed.entity,
                            id: parsed.id,
                          }

                          setSelectedElement(nextSel)
                          void loadSelectedElementContext(nextSel)

                          if (ev.type === 'click') {
                            setPointFromClient(ev.clientX, ev.clientY)
                            setEditPopoverOpen(true)
                          } else {
                            // Right-click selects element; Radix context menu opens via bubbling event.
                            setEditPopoverOpen(false)
                          }
                        }}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {entityTypesLoaded ? (
                    entityTypes.length ? (
                    entityTypes.map((t) => (
                      <ContextMenuItem
                        key={t}
                        onClick={() => {
                          void openAddPopoverWithType(t)
                        }}
                      >
                        {t}
                      </ContextMenuItem>
                    ))
                    ) : (
                      <ContextMenuItem disabled>
                        <span className="text-xs text-muted-foreground">No available types</span>
                      </ContextMenuItem>
                    )
                  ) : (
                    <ContextMenuItem disabled>
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    </ContextMenuItem>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Move className="mr-2 h-4 w-4" />
                  Move
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {moveTargetsLoaded ? (
                    moveTargets.length ? (
                    moveTargets.map((t) => (
                      <ContextMenuItem
                        key={`${t.entity ?? 'root'}:${t.id}`}
                        onClick={() => {
                          if (t.entity === 'root' && (t.id === 'infrastructure' || t.id === 'definitions')) {
                            void handleMoveEntity({ root: t.id })
                            return
                          }
                          if (!t.entity || !t.id) return
                          void handleMoveEntity({ entity: t.entity, id: t.id })
                        }}
                          disabled={!selectedElement || selectedElement.entity === 'root'}
                      >
                        {t.name ?? `${t.entity}_${t.id}`} ({t.entity})
                      </ContextMenuItem>
                    ))
                    ) : (
                      <ContextMenuItem disabled>
                        <span className="text-xs text-muted-foreground">No move targets</span>
                      </ContextMenuItem>
                    )
                  ) : (
                    <ContextMenuItem disabled>
                      <span className="text-xs text-muted-foreground">Loading…</span>
                    </ContextMenuItem>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSeparator />

              <ContextMenuItem
                onClick={() => {
                  const current = selectedElementRef.current
                  if (!current) return
                  const rect = contextMenuRef.current?.getBoundingClientRect()
                  if (rect) setEditPopoverPoint({ x: rect.width / 2, y: rect.height / 2 })
                  void loadSelectedElementContext(current)
                  setEditPopoverOpen(true)
                }}
                disabled={!selectedElement || selectedElement.entity === 'root'}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit Selected
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => {
                  if (!selectedElementRef.current) return
                  setDeleteDialogOpen(true)
                }}
                className="text-destructive"
                disabled={!selectedElement || selectedElement.entity === 'root'}
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
                  <h4 className="font-medium leading-none">
                    {selectedElement?.entity && selectedElement.entity !== 'root'
                      ? `[${selectedElement.entity}] ${getAttributeValue(attributes, 'name') || selectedElement.id}`
                      : 'Edit Entity'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Update entity attributes
                  </p>
                </div>

                {errorMessage && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMessage}
                  </div>
                )}

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    {(() => {
                      const entityType = selectedElement?.entity ?? ''
                      const requiredKeys = entityType ? (entityTypeDetails[entityType]?.requiredAttributes ?? []) : []
                      const requiredSet = new Set(requiredKeys)
                      const otherKeys = attributes
                        .map((a) => a.key.trim())
                        .filter((k) => k && !requiredSet.has(k))

                      const renderField = (key: string, required: boolean) => {
                        const value = getAttributeValue(attributes, key)
                        const label = required ? (
                          <span className="inline-flex items-center gap-1">
                            <span>{key}</span>
                            <span className="text-destructive">*</span>
                          </span>
                        ) : (
                          key
                        )

                        const onValueChange = (next: string) => {
                          if (!entityType) return
                          if (key === 'name') return handleNameValueChange(entityType, next)
                          if (key === 'slug') return handleSlugValueChange(entityType, next)
                          applyAttributeUpdates(entityType, { [key]: next })
                        }

                        return (
                          <div key={key} className="grid gap-1">
                            <Label>{label}</Label>
                            <Input
                              value={value}
                              onChange={(e) => onValueChange(e.target.value)}
                              disabled={loading}
                            />
                          </div>
                        )
                      }

                      return (
                        <div className="grid gap-3">
                          {requiredKeys.length > 0 ? (
                            <>
                              <Label>Required fields</Label>
                              {requiredKeys.map((k) => renderField(k, true))}
                            </>
                          ) : (
                            <Label>Attributes</Label>
                          )}

                          {otherKeys.length > 0 && (
                            <>
                              <Label>Other fields</Label>
                              {otherKeys.map((k) => renderField(k, false))}
                            </>
                          )}

                          {requiredKeys.length === 0 && otherKeys.length === 0 && (
                            <div className="text-sm text-muted-foreground">No editable attributes for this selection.</div>
                          )}
                        </div>
                      )
                    })()}
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
                    disabled={loading || selectedElement?.entity === 'root'}
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
            Add and Move options follow the selected element and the model hierarchy.
          </p>
        </div>
      </div>

      {/* Add Entity Popover */}
      <Popover
        open={addPopoverOpen}
        onOpenChange={(open) => {
          setAddPopoverOpen(open)
          if (!open) {
            setAddPopoverPoint(null)
            setCreateEntityType('')
            setCreateParent(DEFAULT_ROOT_PARENT)
            setAddErrorMessage(null)
          }
        }}
      >
        {addPopoverPoint && (
          <PopoverAnchor asChild>
            <span style={{ position: 'fixed', left: addPopoverPoint.x, top: addPopoverPoint.y, width: 1, height: 1 }} />
          </PopoverAnchor>
        )}
        <PopoverContent className="w-80" align="center" sideOffset={12}>
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Add New Entity</h4>
              <p className="text-sm text-muted-foreground">
                Create a new infrastructure element
              </p>
            </div>

            {addErrorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive whitespace-pre-line">
                {addErrorMessage}
              </div>
            )}

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="entity-type">Entity Type</Label>
                <select
                  id="entity-type"
                  value={createEntityType}
                  onChange={(e) => {
                    const nextType = e.target.value
                    setAddErrorMessage(null)
                    setCreateEntityType(nextType)
                    if (nextType) {
                      slugTouchedRef.current = false
                      slugAutoRef.current = ''
                      setAttributes((cur) => ensureAttributesForEntityType(nextType, cur))
                    }
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
                        const entityType = createEntityType
                        if (!entityType) {
                          const newAttrs = [...attributes]
                          newAttrs[idx].value = e.target.value
                          setAttributes(newAttrs)
                          return
                        }

                        const key = attr.key.trim()
                        if (!key) {
                          const newAttrs = [...attributes]
                          newAttrs[idx].value = e.target.value
                          setAttributes(newAttrs)
                          return
                        }
                        if (key === 'name') {
                          handleNameValueChange(entityType, e.target.value)
                          return
                        }
                        if (key === 'slug') {
                          handleSlugValueChange(entityType, e.target.value)
                          return
                        }

                        applyAttributeUpdates(entityType, { [key]: e.target.value })
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
                disabled={loading || !createEntityType}
              >
                {loading ? 'Creating...' : 'Create'}
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
