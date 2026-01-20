import Link from 'next/link';

type EditorPageProps = {
  params: { id: string };
};

import { redirect } from 'next/navigation';

import { backendFetch } from '../../../lib/backend';

type Diagram = {
  id: string;
  name: string;
  content: string;
};

async function createRegionAction(diagramId: string, formData: FormData) {
  'use server';

  const name = String(formData.get('name') ?? 'Region 1').trim();
  const slug = String(formData.get('slug') ?? 'region-1').trim();

  const res = await backendFetch(`/api/diagrams/${diagramId}/commands`, {
    method: 'POST',
    body: JSON.stringify({
      command: 'create',
      entity: 'region',
      parent: { root: 'definitions' },
      attributes: { name, slug },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to apply command (${res.status})`);
  }

  redirect(`/editor/${diagramId}`);
}

export default async function EditorPage({ params }: { params: { id: string } }) {
  const res = await backendFetch(`/api/diagrams/${params.id}`, { method: 'GET' });
  if (!res.ok) {
    return (
      <section aria-label="Editor">
        <h1>Editor</h1>
        <p>Diagram not found.</p>
        <p>
          <Link href="/">Back to diagrams list</Link>
        </p>
      </section>
    );
  }

  const diagram = (await res.json()) as Diagram;

  return (
    <section aria-label="Editor">
      <h1>Editor (backend-driven scaffold)</h1>
      <p>
        Diagram: <strong>{diagram.name}</strong> (<code>{diagram.id}</code>)
      </p>

      <form action={createRegionAction.bind(null, diagram.id)} style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <label>
          <span className="sr-only">Region name</span>
          <input name="name" defaultValue="Region 1" aria-label="Region name" style={{ padding: 8 }} />
        </label>
        <label>
          <span className="sr-only">Region slug</span>
          <input name="slug" defaultValue="region-1" aria-label="Region slug" style={{ padding: 8 }} />
        </label>
        <button type="submit">Create region (mock command)</button>
      </form>

      <p>
        <Link href="/">Back to diagrams list</Link>
      </p>

      <h2>Mermaid (render target)</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{diagram.content}</pre>
    </section>
  );
}
