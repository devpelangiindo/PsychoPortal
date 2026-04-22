'use server'

import { handleServerFunctions as payloadHandleServerFunctions } from '@payloadcms/next/layouts'
import configPromise from '@payload-config'

export const handleServerFunctions = async (args: Parameters<typeof payloadHandleServerFunctions>[0]) => {
  return payloadHandleServerFunctions({
    ...args,
    config: configPromise,
  })
}
