import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/admin',
  serverExternalPackages: ['sharp', 'payload', '@payloadcms/db-postgres', 'graphql'],
  reactStrictMode: false,
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
