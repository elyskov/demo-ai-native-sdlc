"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { apiFetchJson } from '@/lib/backend';
import { downloadViaFetch, safeFilename, slugifyFilenamePart } from '@/lib/download';

type DiagramMetadata = {
  id: string;
  name: string;
};

type DiagramsListProps = {
  diagrams: DiagramMetadata[];
};

type CsvOrderedTypesResponse = {
  diagramId: string;
  category: string;
  types: string[];
};

type TypesLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; types: string[] };

function typesToMenuItems(state: TypesLoadState): { label: string; disabled: boolean; type?: string }[] {
  if (state.status === 'loading') return [{ label: 'Loading...', disabled: true }];
  if (state.status === 'error') return [{ label: 'Failed to load types', disabled: true }];
  if (state.status === 'ready' && state.types.length === 0) return [{ label: 'No types found', disabled: true }];
  if (state.status === 'ready') return state.types.map((t) => ({ label: t, disabled: false, type: t }));
  return [{ label: 'Open to load...', disabled: true }];
}

export function DiagramsList({ diagrams }: DiagramsListProps) {
  const router = useRouter();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramMetadata | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput || 'New Diagram' }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create diagram (${res.status})`);
      }

      const created = await res.json() as { id: string };
      router.push(`/editor/${created.id}`);
    } catch (error) {
      console.error('Failed to create diagram:', error);
      alert('Failed to create diagram');
    } finally {
      setLoading(false);
      setCreateDialogOpen(false);
      setNameInput('');
    }
  };

  const handleRename = async () => {
    if (!selectedDiagram) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/diagrams/${selectedDiagram.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameInput }),
      });

      if (!res.ok) {
        throw new Error(`Failed to rename diagram (${res.status})`);
      }

      router.refresh();
    } catch (error) {
      console.error('Failed to rename diagram:', error);
      alert('Failed to rename diagram');
    } finally {
      setLoading(false);
      setRenameDialogOpen(false);
      setSelectedDiagram(null);
      setNameInput('');
    }
  };

  const handleDelete = async () => {
    if (!selectedDiagram) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/diagrams/${selectedDiagram.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Failed to delete diagram (${res.status})`);
      }

      router.refresh();
    } catch (error) {
      console.error('Failed to delete diagram:', error);
      alert('Failed to delete diagram');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setSelectedDiagram(null);
    }
  };

  const openRenameDialog = (diagram: DiagramMetadata) => {
    setSelectedDiagram(diagram);
    setNameInput(diagram.name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (diagram: DiagramMetadata) => {
    setSelectedDiagram(diagram);
    setDeleteDialogOpen(true);
  };

  const fetchTypesForCategory = async (diagramId: string, category: 'Definitions' | 'Infrastructure'): Promise<string[]> => {
    const res = await apiFetchJson<CsvOrderedTypesResponse>(
      `/api/csv/${encodeURIComponent(diagramId)}?category=${encodeURIComponent(category)}`,
      { method: 'GET' },
    );
    return Array.isArray(res.types) ? res.types : [];
  };

  const downloadZip = async (diagram: DiagramMetadata) => {
    const slug = slugifyFilenamePart(diagram.name) || 'diagram';
    const filename = safeFilename(`diagram-${slug}-csv.zip`, 'diagram-csv.zip');
    await downloadViaFetch(`/api/csv/${encodeURIComponent(diagram.id)}/zip`, filename);
  };

  const downloadCsvType = async (diagram: DiagramMetadata, type: string) => {
    const slug = slugifyFilenamePart(diagram.name) || 'diagram';
    const filename = safeFilename(`diagram-${slug}-${type}.csv`, `diagram-${slug}.csv`);
    await downloadViaFetch(
      `/api/csv/${encodeURIComponent(diagram.id)}?type=${encodeURIComponent(type)}`,
      filename,
    );
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 min-h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Diagrams</h1>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Diagram
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Diagram</DialogTitle>
              <DialogDescription>
                Enter a name for your new C4 deployment diagram.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="New Diagram"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <ScrollArea className="h-[60vh] w-full">
          {diagrams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No diagrams yet. Create your first diagram to get started.</p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y">
              {diagrams.map((diagram) => (
                <div
                  key={diagram.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <button
                    onClick={() => router.push(`/editor/${diagram.id}`)}
                    className="flex-1 text-left font-medium hover:underline"
                  >
                    {diagram.name}
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Download submenu */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          Download
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await downloadZip(diagram);
                              } catch (err) {
                                console.error('Failed to download ZIP:', err);
                                alert('Failed to download ZIP');
                              }
                            }}
                          >
                            All CSV files (ZIP)
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <CategorySubmenu
                            label="Definitions"
                            diagram={diagram}
                            category="Definitions"
                            fetchTypes={fetchTypesForCategory}
                            onDownloadType={downloadCsvType}
                          />

                          <CategorySubmenu
                            label="Infrastructure"
                            diagram={diagram}
                            category="Infrastructure"
                            fetchTypes={fetchTypesForCategory}
                            onDownloadType={downloadCsvType}
                          />
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => router.push(`/editor/${diagram.id}`)}>
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openRenameDialog(diagram)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(diagram)}
                        className="text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Diagram</DialogTitle>
            <DialogDescription>
              Enter a new name for &quot;{selectedDiagram?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-name">Name</Label>
              <Input
                id="rename-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Diagram name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={loading}>
              {loading ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Diagram</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedDiagram?.name}&quot;? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategorySubmenu(props: {
  label: string;
  diagram: { id: string; name: string };
  category: 'Definitions' | 'Infrastructure';
  fetchTypes: (diagramId: string, category: 'Definitions' | 'Infrastructure') => Promise<string[]>;
  onDownloadType: (diagram: { id: string; name: string }, type: string) => Promise<void>;
}) {
  const [state, setState] = useState<TypesLoadState>({ status: 'idle' });

  const ensureLoaded = async () => {
    if (state.status === 'loading' || state.status === 'ready') return;
    setState({ status: 'loading' });
    try {
      const types = await props.fetchTypes(props.diagram.id, props.category);
      setState({ status: 'ready', types });
    } catch (err) {
      console.error(`Failed to load ${props.category} types:`, err);
      setState({ status: 'error', message: String(err) });
    }
  };

  return (
    <DropdownMenuSub
      onOpenChange={(open) => {
        if (open) {
          void ensureLoaded();
        }
      }}
    >
      <DropdownMenuSubTrigger>
        {props.label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {typesToMenuItems(state).map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onClick={async () => {
              if (!item.type) return;
              try {
                await props.onDownloadType(props.diagram, item.type);
              } catch (err) {
                console.error('Failed to download CSV:', err);
                alert('Failed to download CSV');
              }
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
