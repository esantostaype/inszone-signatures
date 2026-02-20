import { GlobalModal } from '@/components'
import { GlobalConfirmation } from '@/components/Confirmation'
import { Providers } from '../providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <main className='mx-auto w-7xl py-10'>
          { children }
      </main>
      <GlobalModal />
      <GlobalConfirmation />
    </Providers>
  )
}