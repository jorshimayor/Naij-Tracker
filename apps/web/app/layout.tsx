import './globals.css';
import type { Metadata } from 'next';
import { Cinzel, Crimson_Pro } from 'next/font/google';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

const display = Cinzel({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const serif = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Naija Bill Tracker',
    template: '%s · Naija Bill Tracker',
  },
  description:
    'Track every bill moving through the Nigerian Senate, House of Representatives, and State Houses of Assembly — in plain English.',
  openGraph: {
    title: 'Naija Bill Tracker',
    description:
      'Track every bill moving through the Nigerian Senate, House of Representatives, and State Houses of Assembly — in plain English.',
    type: 'website',
  },
};

// Inline script — runs before paint to set the theme class, preventing a flash of the wrong theme.
const THEME_INIT = `
(function(){
  try{
    var m = localStorage.getItem('nbt-theme') || 'system';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = m === 'dark' || (m === 'system' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
