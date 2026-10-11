import { useT, t as tNow } from '../i18n'
import { memo, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, CheckCircle2, Loader2, AlertTriangle, Layers, Package } from 'lucide-react'
import type { Game } from '../types'
import type { ColorScheme } from './shared'

import { useInstalledGames } from '../store'

interface DLCItem {
  appid: string
  name: string
  header_image?: string
}

interface DLCManagerProps {
  game: Game | null
  isOpen: boolean
  onClose: () => void
  colors: ColorScheme
  bridge: any
  showToast: (msg: string, type: string) => void
}

type DLCState = 'idle' | 'installing' | 'installed' | 'error'

export const DLCManager = memo(function DLCManager({
  game,
  isOpen,
  onClose,
  colors,
  bridge,
  showToast,
}: DLCManagerProps) {
  const t = useT()
  const [dlcs, setDlcs] = useState<DLCItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set())
  const [dlcStates, setDlcStates] = useState<Record<string, DLCState>>({})
  const installedGames = useInstalledGames()

  // Check which DLCs are already installed
  const installedAppids = new Set(
    (installedGames || []).map((g: any) => String(g.appid || g.id))
  )

  // ── Fetch DLCs on mount ──
  useEffect(() => {
    if (!isOpen || !game?.appid) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setDlcs([])
    setDlcStates({})

    ;(async () => {
      try {
        // DLCs already added for this game live in the DLC registry (written by
        // register-dlcs / a game's reseller lua), NOT in the installed-games list
        // (which excludes DLCs) — so consult both to mark them "Installed".
        const [result, registry] = await Promise.all([
          bridge.fetchDLCs(game.appid, game.name),
          bridge.getDlcRegistry(),
        ])
        if (cancelled) return

        const registeredForGame = new Set<string>((registry?.[String(game.appid)] || []).map(String))

        if (result?.dlcs && result.dlcs.length > 0) {
          const dlcDetails = result.dlcDetails || {}
          const dlcNames = result.dlcNames || {}
          const items: DLCItem[] = result.dlcs.map((id: string) => {
            const detail = dlcDetails[id]
            return {
              appid: id,
              name: detail?.name || dlcNames[id] || `DLC ${id}`,
              header_image: detail?.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`,
            }
          })
          setDlcs(items)

          // A DLC counts as installed if it's in the registry for this game OR
          // present in the library (some DLCs get their own lua).
          const initialStates: Record<string, DLCState> = {}
          for (const item of items) {
            initialStates[item.appid] =
              (registeredForGame.has(item.appid) || installedAppids.has(item.appid)) ? 'installed' : 'idle'
          }
          setDlcStates(initialStates)
        } else {
          setError(tNow('ui.dlc.none'))
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || tNow('ui.dlc.fetchFail'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [isOpen, game?.appid, game?.name])

  // ── Install a single DLC ──
  const installDLC = useCallback(async (dlcAppid: string) => {
    if (installingIds.has(dlcAppid)) return
    setInstallingIds(prev => new Set(prev).add(dlcAppid))
    setDlcStates(prev => ({ ...prev, [dlcAppid]: 'installing' }))

    try {
      const result = await bridge.installGame(dlcAppid)
      if (result?.success) {
        setDlcStates(prev => ({ ...prev, [dlcAppid]: 'installed' }))
        showToast(tNow('ui.dlc.toast.installed', { name: dlcs.find(d => d.appid === dlcAppid)?.name || dlcAppid }), 'success')
      } else {
        setDlcStates(prev => ({ ...prev, [dlcAppid]: 'error' }))
        showToast(result?.message || tNow('ui.dlc.toast.failed', { id: dlcAppid }), 'error')
      }
    } catch (e: any) {
      setDlcStates(prev => ({ ...prev, [dlcAppid]: 'error' }))
      showToast(tNow('ui.dlc.toast.error', { err: e?.message }), 'error')
    } finally {
      setInstallingIds(prev => {
        const next = new Set(prev)
        next.delete(dlcAppid)
        return next
      })
    }
  }, [installingIds, bridge, dlcs, showToast])

  // ── Install all uninstalled DLCs ──
  const installAll = useCallback(async () => {
    const uninstalled = dlcs.filter(d => dlcStates[d.appid] !== 'installed')
    for (const dlc of uninstalled) {
      await installDLC(dlc.appid)
    }
  }, [dlcs, dlcStates, installDLC])

  const hasUninstalled = dlcs.some(d => dlcStates[d.appid] !== 'installed')
  const allInstalled = dlcs.length > 0 && !hasUninstalled

  return (
    <AnimatePresence>
      {isOpen && game && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[160] flex items-center justify-center p-4"
          style={{ background: 'rgba(4,4,10,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            className="w-full overflow-hidden"
            style={{
              maxWidth: 520,
              maxHeight: '80vh',
              background: '#0f0f1b',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 24,
              boxShadow: '0 60px 120px -30px rgba(0,0,0,1)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2.5">
                <Layers size={18} style={{ color: colors.violet }} />
                <h2 className="text-lg font-bold" style={{ color: colors.text }}>
                  {t('ui.dlc.title')}
                </h2>
                {!loading && dlcs.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: `${colors.violet}20`,
                    color: colors.violetLight || colors.violet,
                    border: `1px solid ${colors.violet}30`,
                  }}>
                    {t('ui.dlc.available', { n: dlcs.length })}
                  </span>
                )}
              </div>
              <motion.button
                onClick={onClose}
                aria-label={t('ui.common.close')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <X size={16} style={{ color: colors.textMuted }} />
              </motion.button>
            </div>

            {/* ── Game info sub-header ── */}
            <div className="px-5 py-3 flex items-center gap-3 shrink-0"
              style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <Package size={14} style={{ color: colors.textMuted }} />
              <span className="text-sm" style={{ color: colors.textMuted }}>
                <span style={{ color: colors.text }}>{game.name}</span>
                {' '}· #{game.appid}
              </span>
            </div>

            {/* ── Body: Loading / Error / List ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 120 }}>
              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="w-12 h-12 rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 rounded-full w-3/5" style={{ background: 'rgba(255,255,255,0.06)' }} />
                        <div className="h-3 rounded-full w-1/4" style={{ background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && error && dlcs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <AlertTriangle size={28} style={{ color: colors.warning }} />
                  <p className="text-sm" style={{ color: colors.textMuted }}>{error}</p>
                </div>
              )}

              {!loading && dlcs.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={28} style={{ color: colors.textMuted }} />
                  <p className="text-sm" style={{ color: colors.textMuted }}>{t('ui.dlc.noData')}</p>
                </div>
              )}

              {!loading && dlcs.length > 0 && (
                <div className="space-y-2">
                  {dlcs.map((dlc) => {
                    const state = dlcStates[dlc.appid] || 'idle'
                    const isInstalling = installingIds.has(dlc.appid)
                    const isInstalled = state === 'installed'

                    return (
                      <div
                        key={dlc.appid}
                        className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150"
                        style={{
                          background: isInstalled ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${isInstalled ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        {/* DLC image */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          <img
                            src={dlc.header_image}
                            alt={dlc.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>

                        {/* DLC info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: colors.text }}>
                            {dlc.name}
                          </p>
                          <p className="text-[11px]" style={{ color: colors.textMuted }}>
                            #{dlc.appid}
                          </p>
                        </div>

                        {/* Action button */}
                        {isInstalled ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium"
                            style={{ color: colors.green }}
                          >
                            <CheckCircle2 size={14} />
                            {t('ui.common.installed')}
                          </div>
                        ) : (
                          <motion.button
                            onClick={() => installDLC(dlc.appid)}
                            disabled={isInstalling}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                            style={{
                              background: state === 'error'
                                ? 'rgba(239,68,68,0.15)'
                                : 'var(--acc,#a77dff)',
                              color: state === 'error' ? '#fca5a5' : '#0b0614',
                            }}
                          >
                            {isInstalling ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : state === 'error' ? (
                              <AlertTriangle size={12} />
                            ) : (
                              <Download size={12} />
                            )}
                            {isInstalling ? t('ui.common.installing') : state === 'error' ? t('ui.common.retry') : t('ui.common.install')}
                          </motion.button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Footer: Install All ── */}
            {!loading && dlcs.length > 0 && (
              <div className="px-5 py-3 border-t shrink-0 flex items-center justify-between"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs" style={{ color: colors.textMuted }}>
                  {allInstalled
                    ? t('ui.dlc.allInstalled')
                    : t('ui.dlc.progress', { done: dlcs.filter(d => dlcStates[d.appid] === 'installed').length, total: dlcs.length })
                  }
                </span>
                {!allInstalled && (
                  <motion.button
                    onClick={installAll}
                    disabled={installingIds.size > 0}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-50"
                    style={{
                      background: 'var(--acc,#a77dff)',
                      color: '#0b0614',
                      boxShadow: '0 16px 40px -14px var(--acc,#a77dff)',
                    }}
                  >
                    {installingIds.size > 0 ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {t('ui.dlc.installAll', { n: dlcs.length - dlcs.filter(d => dlcStates[d.appid] === 'installed').length })}
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
