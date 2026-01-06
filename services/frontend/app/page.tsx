import Link from 'next/link';

export default function DiagramsListPage() {
  return (
    <section aria-label="Diagrams list">
      <h1>Diagrams List (placeholder)</h1>
      <p>
        This will list existing diagrams and provide a “New” action.
      </p>
      <p>
        <Link href="/editor/demo">Open example editor</Link>
      </p>
    </section>
  );
}
