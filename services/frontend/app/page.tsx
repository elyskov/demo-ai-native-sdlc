import { DiagramsList } from './diagrams-list';

import { backendFetch } from '../lib/backend';

type DiagramMetadata = {
  id: string;
  name: string;
};

export default async function DiagramsListPage() {
  const res = await backendFetch('/api/diagrams', { method: 'GET' });
  const diagrams = (res.ok ? ((await res.json()) as DiagramMetadata[]) : [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return <DiagramsList diagrams={diagrams} />;
}
