import React, { memo,  useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, CheckCircle, AlertCircle, RefreshCw, ExternalLink, Github, Package, ArrowDown, Sparkles, Terminal, FileArchive, Loader2 } from 'lucide-react'
import { COLORS } from '../constants/colors'

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  currentVersion: string
}

function parseMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.JSX.Element[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="ml-5 my-2 space-y-1 list-disc marker:text-violet-400">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm" style={{ color: COLORS.textSecondary }}>{item}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={key++} className="text-base font-bold mt-4 mb-2" style={{ color: COLORS.text }}>
          {trimmed.slice(4)}
        </h4>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={key++} className="text-lg font-bold mt-5 mb-2" style={{ color: COLORS.white }}>
          {trimmed.slice(3)}
        </h3>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-xl font-bold mt-5 mb-3" style={{ color: COLORS.white }}>
          {trimmed.slice(2)}
        </h2>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2))
    } else if (/^\d+\.\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s/, ''))
    } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList()
      elements.push(<hr key={key++} className="my-4 border-opacity-30" style={{ borderColor: COLORS.border }} />)
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      flushList()
      elements.push(
        <p key={key++} className="text-sm font-bold my-2" style={{ color: COLORS.text }}>
          {trimmed.slice(2, -2)}
        </p>
      )
    } else if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
      flushList()
      elements.push(
        <code key={key++} className="px-2 py-0.5 rounded text-sm font-mono" style={{ background: COLORS.bgHover, color: COLORS.cyan }}>
          {trimmed.slice(1, -1)}
        </code>
      )
    } else if (trimmed.length > 0) {
      flushList()
      elements.push(
        <p key={key++} className="text-sm my-1" style={{ color: COLORS.textSecondary }}>
          {trimmed}
        </p>
      )
    }
  }
  
  flushList()
  return elements
}

export const UpdateModal = memo(function UpdateModal({ isOpen, onClose, currentVersion }: UpdateModalProps) {
  const [checking, setChecking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState<{
    hasUpdate: boolean
    latestVersion: string
    releaseNotes: string
    releaseUrl: string
    downloadUrl: string | null
    downloadSize: number
  } | null>(null)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [installComplete, setInstallComplete] = useState(false)
  const [installFilesCount, setInstallFilesCount] = useState(0)
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-8), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const checkForUpdates = useCallback(async () => {
    setChecking(true)
    setError(null)
    setResult(null)
    setDownloadComplete(false)
    setRestartNeeded(false)
    setLogs([])
    
    try {
      const api = (window as any).electronAPI
      if (api && api.checkForUpdates) {
        const data = await api.checkForUpdates()
        setResult({
          hasUpdate: data.hasUpdate,
          latestVersion: data.latestVersion,
          releaseNotes: data.releaseNotes || 'No release notes available.',
          releaseUrl: data.releaseUrl,
          downloadUrl: data.downloadUrl,
          downloadSize: data.downloadSize,
        })
      }
    } catch (e: any) {
      setError(e.message || 'Failed to check for updates')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && !result && !checking) {
      checkForUpdates()
    }
  }, [isOpen, result, checking, checkForUpdates])

  useEffect(() => {
    const api = (window as any).electronAPI
    if (api && api.onDownloadProgress) {
      api.onDownloadProgress((data: { percent: number, message?: string }) => {
        setProgress(data.percent)
        if (data.message) addLog(data.message)
      })
    }
  }, [])

  const handleDownload = useCallback(async () => {
    if (!result?.downloadUrl) return
    
    setDownloading(true)
    setDownloadComplete(false)
    setInstallComplete(false)
    setProgress(0)
    setError(null)
    setLogs([])
    
    try {
      const api = (window as any).electronAPI
      if (api && api.downloadUpdate) {
        addLog(`Starting download of v${result.latestVersion}...`)
        
        const res = await api.downloadUpdate(result.downloadUrl, '')
        
        if (res.success) {
          addLog('Download complete!')
          setProgress(100)
          setDownloadComplete(true)
          if (res.filesCopied) {
            setInstallComplete(true)
            setInstallFilesCount(res.filesCopied)
            setRestartNeeded(true)
            addLog(`Installed ${res.filesCopied} files!`)
          }
        } else {
          setError(res.message || 'Download failed')
          addLog(`Error: ${res.message}`)
        }
      }
    } catch (e: any) {
      setError(e.message || 'Download failed')
      addLog(`Error: ${e.message}`)
    } finally {
      setDownloading(false)
    }
  }, [result])

  const handleInstall = useCallback(async () => {
    setInstalling(true)
    setError(null)
    setProgress(0)
    addLog('Installing update from downloaded file...')
    
    try {
      const api = (window as any).electronAPI
      if (api && api.installUpdate) {
        const res = await api.installUpdate()
        
        if (res.success) {
          addLog('Installation complete!')
          setProgress(100)
          setInstallComplete(true)
          setInstallFilesCount(res.filesCopied || 0)
          setRestartNeeded(true)
        } else {
          setError(res.message || 'Installation failed')
          addLog(`Error: ${res.message}`)
        }
      }
    } catch (e: any) {
      setError(e.message || 'Installation failed')
      addLog(`Error: ${e.message}`)
    } finally {
      setInstalling(false)
    }
  }, [])

  const handleRestart = useCallback(async () => {
    const api = (window as any).electronAPI
    if (api && api.restartApp) {
      api.restartApp()
    }
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const parsedNotes = useMemo(() => result?.releaseNotes ? parseMarkdown(result.releaseNotes) : [], [result?.releaseNotes])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ 
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(20px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative w-[850px] max-w-full h-[80vh] rounded-3xl overflow-hidden flex flex-col"
            style={{ 
              background: `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.bgDeep} 100%)`,
              border: `1px solid ${COLORS.border}`,
              boxShadow: `0 25px 100px rgba(0,0,0,0.7), 0 0 60px ${COLORS.violet}20`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-5 flex-shrink-0" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: COLORS.bgHover }}
              >
                <X size={18} style={{ color: COLORS.textMuted }} />
              </motion.button>
              
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ 
                  background: `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.blue} 100%)`,
                  boxShadow: `0 8px 30px ${COLORS.violet}40`
                }}>
                  <Package size={28} style={{ color: COLORS.white }} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Software Update</h2>
                  <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>Current version: v{currentVersion}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {checking && (
                <div className="flex flex-col items-center justify-center py-16 flex-1">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-16 h-16 rounded-full border-3 border-t-transparent"
                    style={{ borderColor: COLORS.violet, borderTopColor: 'transparent' }}
                  />
                  <p className="mt-6 text-lg font-medium text-white">Checking for updates...</p>
                  <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>Connecting to GitHub</p>
                </div>
              )}

              {error && (
                <div className="mx-6 mt-4 flex items-center gap-3 p-4 rounded-2xl" style={{ background: COLORS.red + '15', border: `1px solid ${COLORS.red}30` }}>
                  <AlertCircle size={20} style={{ color: COLORS.red }} />
                  <p className="text-sm" style={{ color: COLORS.red }}>{error}</p>
                </div>
              )}

              {result && !checking && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {result.hasUpdate ? (
                    <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                      {/* Update Available Banner */}
                      <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-4 p-5 rounded-2xl"
                        style={{ 
                          background: `linear-gradient(135deg, ${COLORS.green}20 0%, ${COLORS.green}05 100%)`,
                          border: `1px solid ${COLORS.green}40`
                        }}
                      >
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: COLORS.green + '25' }}>
                          <Sparkles size={24} style={{ color: COLORS.green }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-white">Update Available!</p>
                          <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
                            Version <span className="font-semibold" style={{ color: COLORS.green }}>v{result.latestVersion}</span> is ready to download
                          </p>
                        </div>
                        {result.downloadSize > 0 && (
                          <div className="text-right">
                            <p className="text-xs" style={{ color: COLORS.textMuted }}>Download size</p>
                            <p className="text-sm font-semibold" style={{ color: COLORS.text }}>{formatSize(result.downloadSize)}</p>
                          </div>
                        )}
                      </motion.div>

                      {/* Release Notes */}
                      <div className="flex-1 overflow-hidden flex flex-col rounded-2xl" style={{ background: COLORS.bgDark, border: `1px solid ${COLORS.border}` }}>
                        <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Release Notes</p>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                          <div className="space-y-1">
                            {parsedNotes}
                          </div>
                        </div>
                      </div>

                      {/* Download Section - Updated */}
                      <div className="flex-shrink-0 space-y-3">
                        {/* Progress Bar */}
                        {(downloading || downloadComplete) && (
                          <div className="space-y-3 p-4 rounded-2xl" style={{ background: COLORS.bgDark, border: `1px solid ${COLORS.border}` }}>
                            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: COLORS.bgHover }}>
                              <motion.div
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{ 
                                  background: downloadComplete 
                                    ? COLORS.green 
                                    : `linear-gradient(90deg, ${COLORS.violet} 0%, ${COLORS.green} 100%)`,
                                }}
                                animate={{ width: downloadComplete ? '100%' : `${progress}%` }}
                                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm" style={{ color: COLORS.textMuted }}>
                                {downloadComplete ? 'Update ready!' : `Downloading... ${progress}%`}
                              </p>
                              {downloading && (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                >
                                  <Loader2 size={16} style={{ color: COLORS.violet }} />
                                </motion.div>
                              )}
                            </div>
                            
                            {/* Log Terminal */}
                            {logs.length > 0 && (
                              <div className="mt-3 p-3 rounded-xl font-mono text-xs" style={{ background: COLORS.bgDeep, border: `1px solid ${COLORS.border}` }}>
                                <div className="flex items-center gap-2 mb-2" style={{ color: COLORS.textMuted }}>
                                  <Terminal size={12} />
                                  <span>Progress Log</span>
                                </div>
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {logs.map((log, i) => (
                                    <p key={i} style={{ color: COLORS.textSecondary }}>{log}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {restartNeeded ? (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="space-y-3"
                          >
                            {/* Success Card */}
                            <div className="p-5 rounded-2xl text-center" style={{ 
                              background: `linear-gradient(135deg, ${COLORS.green}20, ${COLORS.green}05)`, 
                              border: `1px solid ${COLORS.green}40` 
                            }}>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center"
                                style={{ background: COLORS.green + '30' }}
                              >
                                <CheckCircle size={32} style={{ color: COLORS.green }} />
                              </motion.div>
                              <p className="text-lg font-bold" style={{ color: COLORS.green }}>Update Ready!</p>
                              <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
                                v{result.latestVersion} staged — {installFilesCount} files will be applied on restart
                              </p>
                            </div>
                            
                            <motion.button
                              whileHover={{ scale: 1.02, boxShadow: `0 4px 30px ${COLORS.green}50` }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleRestart}
                              className="w-full py-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer"
                              style={{ 
                                background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.green}cc 100%)`, // intentional gradient variation
                                boxShadow: `0 4px 20px ${COLORS.green}40`
                              }}
                            >
                              <RefreshCw size={20} style={{ color: COLORS.white }} />
                              <span className="font-bold text-white text-lg">Restart App Now</span>
                            </motion.button>
                            
                            <p className="text-xs text-center" style={{ color: COLORS.textMuted }}>
                              The new version will launch automatically
                            </p>
                          </motion.div>
                        ) : downloadComplete && !installComplete ? (
                          <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="space-y-3"
                          >
                            <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ 
                              background: COLORS.amber + '15', 
                              border: `1px solid ${COLORS.amber}40` 
                            }}>
                              <FileArchive size={20} style={{ color: COLORS.amber }} />
                              <div className="flex-1">
                                <p className="font-bold" style={{ color: COLORS.amber }}>Download Complete!</p>
                                <p className="text-sm" style={{ color: COLORS.textMuted }}>Click install to apply the update</p>
                              </div>
                            </div>
                            
                            <motion.button
                              whileHover={{ scale: 1.02, boxShadow: `0 4px 25px ${COLORS.violet}50` }}
                              whileTap={{ scale: 0.98 }}
                              disabled={installing}
                              onClick={handleInstall}
                              className="w-full py-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer"
                              style={{ 
                                background: installing 
                                  ? COLORS.violet + '60' 
                                  : `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.blue} 100%)`,
                                boxShadow: `0 4px 20px ${COLORS.violet}40`
                              }}
                            >
                              {installing ? (
                                <>
                                  <Loader2 size={20} style={{ color: COLORS.white }} className="animate-spin" />
                                  <span className="font-bold text-white">Installing...</span>
                                </>
                              ) : (
                                <>
                                  <Package size={20} style={{ color: COLORS.white }} />
                                  <span className="font-bold text-white text-lg">Install Update</span>
                                </>
                              )}
                            </motion.button>
                          </motion.div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: downloading ? 1 : 1.02, boxShadow: `0 4px 25px ${COLORS.violet}40` }}
                            whileTap={{ scale: 0.98 }}
                            disabled={!result.downloadUrl || downloading}
                            onClick={handleDownload}
                            className="w-full py-4 rounded-xl flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                              background: downloading
                                ? COLORS.violet + '80'
                                : `linear-gradient(135deg, ${COLORS.violet} 0%, ${COLORS.blue} 100%)`,
                              boxShadow: `0 4px 20px ${COLORS.violet}40`
                            }}
                          >
                            {downloading ? (
                              <>
                                <Loader2 size={20} style={{ color: COLORS.white }} className="animate-spin" />
                                <span className="font-bold text-white">Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download size={20} style={{ color: COLORS.white }} />
                                <span className="font-bold text-white text-lg">Download & Install Update</span>
                                <ArrowDown size={16} style={{ color: COLORS.white }} />
                              </>
                            )}
                          </motion.button>
                        )}

                        {/* GitHub Link */}
                        <motion.a
                          href={result.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 rounded-xl"
                          style={{ 
                            background: COLORS.bgHover,
                            border: `1px solid ${COLORS.border}`
                          }}
                        >
                          <Github size={18} style={{ color: COLORS.textMuted }} />
                          <span className="text-sm font-medium" style={{ color: COLORS.textMuted }}>View on GitHub</span>
                          <ExternalLink size={14} style={{ color: COLORS.textMuted }} />
                        </motion.a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 py-16">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
                        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
                        style={{ 
                          background: `linear-gradient(135deg, ${COLORS.green}40 0%, ${COLORS.green}15 100%)`,
                          boxShadow: `0 8px 40px ${COLORS.green}30`
                        }}
                      >
                        <CheckCircle size={48} style={{ color: COLORS.green }} />
                      </motion.div>
                      <p className="text-2xl font-bold text-white">You're up to date!</p>
                      <p className="text-sm mt-3" style={{ color: COLORS.textMuted }}>Version v{currentVersion} is the latest version</p>
                      
                      <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: COLORS.violet + '20' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={checkForUpdates}
                        disabled={checking || downloading}
                        className="mt-8 py-3 px-6 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40"
                        style={{ 
                          background: COLORS.bgHover,
                          border: `1px solid ${COLORS.border}`
                        }}
                      >
                        <RefreshCw size={16} style={{ color: COLORS.textMuted }} className={checking ? 'animate-spin' : ''} />
                        <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>Check Again</span>
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})
