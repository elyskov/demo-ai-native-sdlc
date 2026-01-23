import type { Metadata } from 'next';
import './globals.css';
import { ThemeToggle } from './theme-toggle';

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
      <body className="min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        <footer className="py-6 flex justify-center">
          <ThemeToggle />
        </footer>
      </body>
    </html>
  );
}
