import { RootLayout } from '@payloadcms/next/layouts'
import configPromise from '@payload-config'
import { importMap } from './(payload)/admin/importMap'
import { handleServerFunctions } from '../utilities/handleServerFunctions'
import '@payloadcms/next/css'

export default function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RootLayout
      config={configPromise}
      importMap={importMap}
      serverFunction={handleServerFunctions}
    >
      {children}
    </RootLayout>
  )
}
