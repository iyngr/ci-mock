import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
    title: 'Talens Suite',
    description: 'Unified internal suite: Talens (faceless real-time interviews), Smart Mock (agentic scoring & hybrid practice generation), Smart Screen (intelligent resume screening).'
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" className="scroll-smooth">
            <body className="font-sans text-ink bg-neutralBg antialiased">
                <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-black text-white px-4 py-2 rounded">Skip to content</a>
                {children}
            </body>
        </html>
    );
}
