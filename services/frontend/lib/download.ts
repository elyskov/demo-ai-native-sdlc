export function slugifyFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function safeFilename(value: string, fallback: string): string {
  const cleaned = value.replace(/[^0-9a-zA-Z _.-]+/g, '_').trim();
  return cleaned.length ? cleaned : fallback;
}

export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;

  // Minimal MVP parsing for: attachment; filename="foo.csv"
  // (We intentionally ignore RFC 5987 filename*= for simplicity.)
  const m = header.match(/filename="?([^";]+)"?/i);
  if (!m) return null;

  const candidate = m[1]?.trim();
  return candidate ? candidate : null;
}

export async function downloadViaFetch(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const headerFilename = parseContentDispositionFilename(res.headers.get('content-disposition'));
  const filename = safeFilename(headerFilename ?? fallbackFilename, 'download');

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Let the browser start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
