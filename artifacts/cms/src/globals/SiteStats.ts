import type { GlobalConfig } from 'payload'

export const SiteStats: GlobalConfig = {
  slug: 'site-stats',
  label: 'Statistik Situs',
  admin: {
    description: 'Angka-angka pencapaian yang ditampilkan di bagian statistik homepage.',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'stats',
      type: 'array',
      label: 'Data Statistik',
      admin: {
        description: 'Tambah atau edit angka pencapaian yang ditampilkan di homepage.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Nilai',
          required: true,
          admin: {
            description: 'e.g., "1500+", "2000", "50+"',
          },
        },
        {
          name: 'label',
          type: 'text',
          label: 'Label',
          required: true,
          admin: {
            description: 'e.g., "Klien Terbantu", "Sesi Terapi & Konseling"',
          },
        },
      ],
    },
  ],
}
