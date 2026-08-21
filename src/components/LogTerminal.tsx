import { memo, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, ChevronUp } from 'lucide-react'
import { COLORS } from '../constants/colors'
interface LogEntry {
  id: number
  type: 'info' | 'success' | 'error' | 'warn'
  message: string
  time: string
}

const violetDim = 'rgba(139, 92, 246, 0.15)'

interface LogTerminalProps {
  logs: LogEntry[]
}

export const LogTerminal = memo(function LogTerminal({ logs }: LogTerminalProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new logs arrive (only when expanded)
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isExpanded])

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return COLORS.error
      case 'success': return COLORS.green
      case 'warn': return COLORS.amber
      case 'info': return COLORS.blue
      default: return COLORS.textMuted
    }
  }

  const recentLogs = logs.slice(-40)

  return (
    <motion.div
      initial={false}
      animate={{ 
        height: isExpanded ? 240 : 44,
        opacity: 1
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-64 right-0 z-40 overflow-hidden"
      style={{ 
        background: 'rgba(8, 8, 14, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(139, 92, 246, 0.12)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header - clickable to expand */}
      <div 
        className="h-11 px-5 flex items-center justify-between cursor-pointer transition-colors"
        style={{ 
          background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
          borderBottom: isExpanded ? `1px solid ${COLORS.violetDim}` : 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Terminal 
            size={14} 
            className={isExpanded ? '' : 'opacity-60'}
            style={{ color: isExpanded ? COLORS.violet : COLORS.textDim }} 
          />
          <span 
            className="text-xs font-semibold tracking-wide"
            style={{ color: COLORS.textMuted }}
          >
            Terminal
          </span>
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ 
              background: violetDim, 
              color: COLORS.violet 
            }}
          >
            {logs.length}
          </span>
        </div>
        
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.08, ease: [0.4, 0, 0.2, 1] }}
        >
          <ChevronUp size={16} style={{ color: COLORS.textDim }} />
        </motion.div>
      </div>
      
      {/* Log Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={scrollRef}
            className="overflow-auto px-4 pb-3 font-mono text-xs"
            style={{ height: 'calc(100% - 44px)' }}
          >
            <AnimatePresence mode="wait">
              {recentLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="py-1 flex items-start gap-3"
                >
                  <span 
                    className="text-xs tabular-nums shrink-0"
                    style={{ color: COLORS.textDim, width: '65px' }}
                  >
                    [{log.time}]
                  </span>
                  <span 
                    className="text-xs uppercase tracking-wider font-semibold shrink-0"
                    style={{ 
                      color: getLogColor(log.type),
                      width: '45px'
                    }}
                  >
                    {log.type}
                  </span>
                  <span 
                    className="break-all"
                    style={{ color: COLORS.textMuted }}
                  >
                    {log.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {logs.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-600">
                No logs yet...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
})
