import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle';
import { GlobalModal, ToastNotification } from '@/components';
import { GlobalConfirmation } from '@/components/Confirmation';
import { QueryProvider } from '@/providers/QueryProvider';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Assignify by Inszone",
  description: "Assignify by Inszone is a smart task automation platform.",
};

// Script que corre ANTES de que React hidrate — elimina el flash
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('joy-mode');
    var mode = stored || 'system';
    var isDark = mode === 'dark' || 
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-joy-color-scheme', isDark ? 'dark' : 'light');
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <html lang="en" className={inter.className}>
        <head>
          {/* Script bloqueante — debe ir antes de cualquier CSS */}
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>
          <QueryProvider>
            <main className='min-h-dvh xl:flex'>
              <ThemeToggle />
              {children}
            </main>
            <GlobalModal />
            <GlobalConfirmation />
            <ToastNotification />
          </QueryProvider>
        </body>
      </html>
    </ThemeProvider>
  );
}