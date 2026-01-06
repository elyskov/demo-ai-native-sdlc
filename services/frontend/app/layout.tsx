import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: 'demo-ai-native-sdlc',
  description: 'Diagram editor (MVP scaffold)'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: '1px solid #ddd' }}>
          <nav
            aria-label="Primary"
            style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}
          >
            <Link href="/">Diagrams</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
