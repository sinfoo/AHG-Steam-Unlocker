import { Game, Fix, PaginatedResponse, SteamStatus, InstallResult } from '../types'

const API_BASE = 'http://localhost:8765'

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    
    return response.json()
  }

  async getGames(
    page: number = 1, 
    limit: number = 50,
    search?: string,
    genre?: string,
    sortBy: string = 'popularity'
  ): Promise<PaginatedResponse<Game>> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort: sortBy,
    })
    
    if (search) params.set('search', search)
    if (genre && genre !== 'All') params.set('genre', genre)
    
    return this.request<PaginatedResponse<Game>>(`/api/games?${params}`)
  }

  async getGame(appid: string): Promise<Game> {
    return this.request<Game>(`/api/games/${appid}`)
  }

  async getFixes(page: number = 1, limit: number = 50): Promise<PaginatedResponse<Fix>> {
    return this.request<PaginatedResponse<Fix>>(
      `/api/fixes?page=${page}&limit=${limit}`
    )
  }

  async getFixForGame(appid: string): Promise<Fix | null> {
    return this.request<Fix | null>(`/api/fixes/${appid}`)
  }

  async installGame(appid: string, includeDLC: boolean = true): Promise<InstallResult> {
    return this.request<InstallResult>('/api/steam/install', {
      method: 'POST',
      body: JSON.stringify({ appid, includeDLC }),
    })
  }

  async uninstallGame(appid: string): Promise<InstallResult> {
    return this.request<InstallResult>('/api/steam/uninstall', {
      method: 'POST',
      body: JSON.stringify({ appid }),
    })
  }

  async getSteamStatus(): Promise<SteamStatus> {
    return this.request<SteamStatus>('/api/steam/status')
  }

  async restartSteam(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/steam/restart', { method: 'POST' })
  }

  async downloadFix(appid: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/fixes/download', {
      method: 'POST',
      body: JSON.stringify({ appid }),
    })
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.request('/api/config')
  }

  async saveConfig(config: Record<string, unknown>): Promise<void> {
    await this.request('/api/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  }
}

export const api = new ApiService()