// CMS API helper — reads from Payload CMS at /admin/api
// All collections have access: { read: () => true } — no auth needed for reads

const CMS_BASE = '/admin/api'

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.json() as Promise<T>
  } catch {
    return null
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CMSMedia {
  url?: string
  alt?: string
  filename?: string
}

export interface CMSPost {
  id: string
  title: string
  slug: string
  excerpt?: string
  contentHtml?: string
  featuredImage?: CMSMedia
  author?: { name?: string; email?: string }
  category?: string
  status: 'draft' | 'published'
  publishedAt?: string
  metaTitle?: string
  metaDescription?: string
  createdAt: string
}

export interface CMSService {
  id: string
  title: string
  slug: string
  shortDescription?: string
  description?: unknown
  descriptionHtml?: string
  featuredImage?: CMSMedia
  icon?: string
  price?: string
  status: 'active' | 'inactive'
  orderIndex: number
}

export interface CMSTestimonial {
  id: string
  text: string
  author: string
  rating: number
  featured: boolean
  orderIndex: number
}

export interface CMSStat {
  value: string
  label: string
}

export interface CMSSiteStats {
  stats?: CMSStat[]
}

export interface CMSList<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export async function fetchPosts(params?: {
  limit?: number
  page?: number
  category?: string
}): Promise<CMSList<CMSPost> | null> {
  const q = new URLSearchParams()
  q.set('where[status][equals]', 'published')
  q.set('sort', '-publishedAt')
  q.set('depth', '1')
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.page) q.set('page', String(params.page))
  if (params?.category) q.set('where[category][equals]', params.category)
  return safeFetch<CMSList<CMSPost>>(`${CMS_BASE}/posts?${q}`)
}

export async function fetchPostBySlug(slug: string): Promise<CMSPost | null> {
  const q = new URLSearchParams()
  q.set('where[slug][equals]', slug)
  q.set('where[status][equals]', 'published')
  q.set('limit', '1')
  q.set('depth', '1')
  const res = await safeFetch<CMSList<CMSPost>>(`${CMS_BASE}/posts?${q}`)
  return res?.docs?.[0] ?? null
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function fetchServices(): Promise<CMSList<CMSService> | null> {
  const q = new URLSearchParams()
  q.set('where[status][equals]', 'active')
  q.set('sort', 'orderIndex')
  q.set('limit', '20')
  q.set('depth', '1')
  return safeFetch<CMSList<CMSService>>(`${CMS_BASE}/services?${q}`)
}

export async function fetchServiceBySlug(slug: string): Promise<CMSService | null> {
  const q = new URLSearchParams()
  q.set('where[slug][equals]', slug)
  q.set('where[status][equals]', 'active')
  q.set('limit', '1')
  q.set('depth', '1')
  const res = await safeFetch<CMSList<CMSService>>(`${CMS_BASE}/services?${q}`)
  return res?.docs?.[0] ?? null
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

export async function fetchTestimonials(): Promise<CMSList<CMSTestimonial> | null> {
  const q = new URLSearchParams()
  q.set('where[featured][equals]', 'true')
  q.set('sort', 'orderIndex')
  q.set('limit', '10')
  return safeFetch<CMSList<CMSTestimonial>>(`${CMS_BASE}/testimonials?${q}`)
}

// ─── Site stats (global) ──────────────────────────────────────────────────────

export async function fetchSiteStats(): Promise<CMSSiteStats | null> {
  return safeFetch<CMSSiteStats>(`${CMS_BASE}/globals/site-stats`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format an ISO date string to Indonesian display format */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Map CMS category slug to display label */
export const CATEGORY_LABELS: Record<string, string> = {
  psikologi: 'Psikologi',
  pendidikan: 'Pendidikan',
  parenting: 'Parenting',
  'kesehatan-mental': 'Kesehatan Mental',
  tips: 'Tips & Trik',
  berita: 'Berita',
}
