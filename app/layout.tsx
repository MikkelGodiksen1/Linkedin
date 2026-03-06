import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">LinkedIn Ops</div>
            <nav className="nav">
              <Link href="/">Dashboard</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
