import { AdminLogo as AdminLogo_pi } from '@/components/AdminLogo'
import { AdminIcon as AdminIcon_pi } from '@/components/AdminLogo'
import { GcsClientUploadHandler as GcsClientUploadHandler_pi } from '@payloadcms/storage-gcs/client'

export const importMap = {
  '/src/components/AdminLogo#AdminLogo': AdminLogo_pi,
  '/src/components/AdminLogo#AdminIcon': AdminIcon_pi,
  '@payloadcms/storage-gcs/client#GcsClientUploadHandler': GcsClientUploadHandler_pi,
}
