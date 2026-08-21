const STEAM_API_BASE = 'https://store.steampowered.com/api'

export interface SteamAppDetails {
  success: boolean
  data?: {
    type?: string
    name?: string
    steam_appid?: number
    required_age?: number
    is_free?: boolean
    controller_support?: string
    dlc?: number[]
    detailed_description?: string
    about_the_game?: string
    short_description?: string
    supported_languages?: string
    header_image?: string
    website?: string
    pc_requirements?: {
      minimum?: string
      recommended?: string
    }
    mac_requirements?: {
      minimum?: string
      recommended?: string
    }
    linux_requirements?: {
      minimum?: string
      recommended?: string
    }
    developers?: string[]
    publishers?: string[]
    price_overview?: {
      currency?: string
      initial?: number
      final?: number
      discount_percent?: number
      initial_formatted?: string
      final_formatted?: string
    }
    packages?: number[]
    package_groups?: any[]
    platforms?: {
      windows?: boolean
      mac?: boolean
      linux?: boolean
    }
    categories?: { id: number; description: string }[]
    genres?: { id: string; description: string }[]
    screenshots?: { id: number; path_thumbnail?: string; path_full?: string }[]
    movies?: { id: number; name?: string; thumbnail?: string; webm?: { '480'?: string; max?: string }; mp4?: { '480'?: string; max?: string }; highlight?: boolean }[]
    achievements?: { total: number; highlighted: { name: string; path: string }[] }
    release_date?: { coming_soon: boolean; date: string }
    support_info?: { url: string; email: string }
    background?: string
    content_descriptors?: { ids: number[]; notes: string }
    metacritic?: { score: number; url: string }
  }
}

const cache = new Map<string, { data: SteamAppDetails; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const pendingRequests = new Map<string, Promise<SteamAppDetails | null>>()

export async function fetchSteamAppDetails(appid: string): Promise<SteamAppDetails | null> {
  const cached = cache.get(appid)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  let pending = pendingRequests.get(appid)
  if (!pending) {
    pending = (async () => {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        
        const response = await fetch(
          `${STEAM_API_BASE}/appdetails?appids=${appid}&cc=us&l=en`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)
        
        if (!response.ok) return null
        
        const json = await response.json()
        const data = json[appid]
        
        if (data?.success && data?.data) {
          cache.set(appid, { data, timestamp: Date.now() })
          return data as SteamAppDetails
        }
        return null
      } catch {
        return null
      } finally {
        pendingRequests.delete(appid)
      }
    })()
    pendingRequests.set(appid, pending)
  }
  
  return pending
}

export function clearSteamApiCache(): void {
  cache.clear()
  pendingRequests.clear()
}

export interface SteamScreenshot {
  thumbnail: string
  full: string
}

export function getScreenshots(details: SteamAppDetails): SteamScreenshot[] {
  if (!details?.data?.screenshots) return []
  return details.data.screenshots.map(s => ({
    thumbnail: s.path_thumbnail || '',
    full: s.path_full || s.path_thumbnail || '',
  }))
}

export function getSystemRequirements(details: SteamAppDetails): { minimum: string; recommended: string } | null {
  if (!details?.data?.pc_requirements) return null
  return {
    minimum: details.data.pc_requirements.minimum || '',
    recommended: details.data.pc_requirements.recommended || '',
  }
}

export function getDeveloper(details: SteamAppDetails): string | null {
  return details?.data?.developers?.[0] || null
}

export function getPublisher(details: SteamAppDetails): string | null {
  return details?.data?.publishers?.[0] || null
}

export function getReleaseDate(details: SteamAppDetails): string | null {
  return details?.data?.release_date?.date || null
}

export function getShortDescription(details: SteamAppDetails): string | null {
  return details?.data?.short_description || null
}

export function getMetacriticScore(details: SteamAppDetails): number | null {
  return details?.data?.metacritic?.score || null
}

export function getSupportedPlatforms(details: SteamAppDetails): { windows: boolean; mac: boolean; linux: boolean } | null {
  if (!details?.data?.platforms) return null
  return {
    windows: details.data.platforms.windows || false,
    mac: details.data.platforms.mac || false,
    linux: details.data.platforms.linux || false,
  }
}
