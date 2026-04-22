'use server'

import { handleServerFunctions as payloadHandleServerFunctions } from '@payloadcms/next/layouts'
import type { ServerFunctionClientArgs } from 'payload'
import configPromise from '@payload-config'
import { importMap } from '../app/(payload)/admin/importMap'

export const handleServerFunctions = async (args: ServerFunctionClientArgs) => {
  return payloadHandleServerFunctions({
    ...args,
    config: configPromise,
    importMap,
  })
}
