import { RootLayout } from '@payloadcms/next/layouts'
import configPromise from '@payload-config'
import React from 'react'
import { importMap } from './(payload)/admin/importMap'
import { handleServerFunctions } from '../utilities/handleServerFunctions'

export default function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="stylesheet" href="/admin/payload-admin-styles" precedence="high" />
      <RootLayout
        config={configPromise}
        importMap={importMap}
        serverFunction={handleServerFunctions}
      >
        {children}
      </RootLayout>
    </>
  )
}
