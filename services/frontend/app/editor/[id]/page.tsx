import Link from 'next/link'
import { DiagramEditor } from '../../editor-client'
import { backendFetch } from '../../../lib/backend'

type EditorPageProps = {
  params: { id: string }
}

type Diagram = {
  id: string
  name: string
  content: string
}

export default async function EditorPage({ params }: EditorPageProps) {
  const res = await backendFetch(`/api/diagrams/${params.id}`, {
    method: 'GET',
  })

  if (!res.ok) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Editor</h1>
        <p className="text-muted-foreground">Diagram not found.</p>
        <Link href="/" className="text-primary underline">
          Back to diagrams list
        </Link>
      </div>
    )
  }

  const diagram = (await res.json()) as Diagram

  return <DiagramEditor diagram={diagram} />
}
