export const dynamic = 'force-dynamic';

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ApiProvider } from '@/contexts/ApiContext'
import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mission Control — Hermes AI Team',
  description: 'Real-time monitoring dashboard for your AI agent crew',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-dark-950 min-h-screen text-white`}>
        <ApiProvider>
          <div className="flex flex-col h-screen">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </ApiProvider>
      </body>
    </html>
  )
}