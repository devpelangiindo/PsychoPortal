import { RootLayout } from '@payloadcms/next/layouts'
import configPromise from '@payload-config'
import { importMap } from './(payload)/admin/importMap'
import { handleServerFunctions } from '../utilities/handleServerFunctions'
import fs from 'fs'
import path from 'path'

// Read payload CSS at build-time on the server so it can be inlined safely
// This avoids any React 19 stylesheet hoisting / hydration mismatch issues.
function getPayloadCSS(): string {
  try {
    const cssPath = path.resolve(
      process.cwd(),
      'node_modules/@payloadcms/next/dist/prod/styles.css',
    )
    return fs.readFileSync(cssPath, 'utf-8')
  } catch {
    return ''
  }
}

const payloadCSS = getPayloadCSS()

export default function RootLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <RootLayout
      config={configPromise}
      importMap={importMap}
      serverFunction={handleServerFunctions}
    >
      {/* Inlined Payload admin CSS — avoids React 19 stylesheet hoisting issues */}
      {payloadCSS && (
        <style
          dangerouslySetInnerHTML={{ __html: payloadCSS }}
          data-payload-admin-styles="true"
        />
      )}
      {children}
    </RootLayout>
  )
}
