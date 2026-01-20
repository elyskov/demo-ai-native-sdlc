import Link from 'next/link';
import { redirect } from 'next/navigation';

import { backendFetch } from '../lib/backend';

type DiagramMetadata = {
  id: string;
  name: string;
};

async function createDiagramAction(formData: FormData) {
  'use server';

  const name = String(formData.get('name') ?? 'New Diagram').trim();
  const res = await backendFetch('/api/diagrams', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    // Keep MVP simple; render error inline later.
    throw new Error(`Failed to create diagram (${res.status})`);
  }

  const created = (await res.json()) as { id: string };
  redirect(`/editor/${created.id}`);
}

export default async function DiagramsListPage() {
  const res = await backendFetch('/api/diagrams', { method: 'GET' });
  const diagrams = (res.ok ? ((await res.json()) as DiagramMetadata[]) : [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section aria-label="Diagrams list">
      <h1>Diagrams</h1>

      <form action={createDiagramAction} style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <label>
          <span className="sr-only">Diagram name</span>
          <input
            name="name"
            defaultValue="New Diagram"
            aria-label="Diagram name"
            style={{ padding: 8 }}
          />
        </label>
        <button type="submit">New</button>
      </form>

      {diagrams.length === 0 ? (
        <p>No diagrams yet.</p>
      ) : (
        <ul>
          {diagrams.map((d) => (
            <li key={d.id}>
              <Link href={`/editor/${d.id}`}>{d.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
