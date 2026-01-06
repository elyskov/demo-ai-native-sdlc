import Link from 'next/link';

type EditorPageProps = {
  params: { id: string };
};

export default function EditorPage({ params }: EditorPageProps) {
  return (
    <section aria-label="Diagram editor">
      <h1>Editor (placeholder)</h1>
      <p>
        Diagram ID: <strong>{params.id}</strong>
      </p>
      <p>
        <Link href="/">Back to diagrams list</Link>
      </p>
    </section>
  );
}
