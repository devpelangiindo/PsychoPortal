import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp', 'payload', '@payloadcms/db-postgres', 'graphql'],
  reactStrictMode: false,
  basePath: '/admin',
  allowedDevOrigins: [
    '*.riker.replit.dev',
    '*.replit.dev',
    process.env.REPLIT_DEV_DOMAIN,
  ].filter(Boolean) as string[],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
