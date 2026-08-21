import { bridge, QueryGamesOpts } from '../bridge'

/**
 * Generic IPC batcher that coalesces concurrent renderer->main calls.
 *
 * Queues calls identified by a unique key per channel, then flushes them
 * as a batch array after either `maxBatchSize` items accumulate or
 * `maxDelayMs` ellapses — whichever comes first.
 *
 * Each batch is sent as a single IPC invoke. Responses are routed back
 * to the caller by index position matching the batch order.
 *
 * Usage:
 *   const batcher = new IpcBatcher({ maxBatchSize: 100, maxDelayMs: 16 });
 *   // Instead of: bridge.imageCacheBatchGet([{ appid }])
 *   const result = await batcher.call('image-cache:batchGet', appid, [{ appid }]);
 */
export class IpcBatcher {
  private maxBatchSize: number
  private maxDelayMs: number
  /** channel -> Map<key, { args: any[], resolve, reject }> */
  private queues = new Map<string, Map<string, PendingEntry>>()
  /** channel -> timer handle */
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(options: { maxBatchSize?: number; maxDelayMs?: number } = {}) {
    this.maxBatchSize = options.maxBatchSize ?? 100
    this.maxDelayMs = options.maxDelayMs ?? 16 // one frame at 60fps
  }

  /**
   * Enqueue an IPC call.
   * @param channel - IPC channel name (e.g. 'image-cache:batchGet')
   * @param key     - Unique key within this channel for dedup (e.g. appid)
   * @param args    - Arguments array that gets spread into the IPC handler
   * @returns       The result from the IPC handler for this entry
   */
  call<T = unknown>(channel: string, key: string, args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
      let queue = this.queues.get(channel)
      if (!queue) {
        queue = new Map()
        this.queues.set(channel, queue)
      }
      // Replace existing entry with latest args (last-write-wins for dedup)
      queue.set(key, { args, resolve: resolve as (v: unknown) => void, reject })

      if (queue.size >= this.maxBatchSize) {
        this.flush(channel)
      } else if (!this.timers.has(channel)) {
        this.timers.set(channel, setTimeout(() => this.flush(channel), this.maxDelayMs))
      }
    })
  }

  /** Flush all queued calls for a given channel immediately. */
  flush(channel: string): void {
    const timer = this.timers.get(channel)
    if (timer) { clearTimeout(timer); this.timers.delete(channel) }

    const queue = this.queues.get(channel)
    if (!queue || queue.size === 0) return
    this.queues.delete(channel)

    const entries = Array.from(queue.entries())
    const batchArgs = entries.map(([, e]) => e.args)

    if (entries.length > 1 && import.meta.env.DEV) {
      console.log('[PERF] IpcBatcher coalesced ' + entries.length + ' calls into 1 batch for channel "' + channel + '"')
    }

    this.dispatchBatch(channel, batchArgs)
      .then((results: unknown[]) => {
        for (let i = 0; i < entries.length; i++) {
          const [, entry] = entries[i]!
          entry.resolve(results[i])
        }
      })
      .catch((err: Error) => {
        for (const [, entry] of entries) entry.reject(err)
      })
  }

  /** Flush ALL channels immediately. */
  flushAll(): void {
    for (const channel of this.queues.keys()) {
      this.flush(channel)
    }
  }

  /**
   * Dispatch a batch of IPC calls for a single channel.
   * Override this in a subclass to customize per-channel dispatch.
   */
  protected async dispatchBatch(channel: string, batchArgs: unknown[][]): Promise<unknown[]> {
    switch (channel) {
      case 'image-cache:batchGet': {
        // --- batch image cache lookups ---
        // Each args entry is [{ appid, preferredImageTypes }] (single-request array).
        // Merge all requests into one big batchGet call.
        const merged = batchArgs.flatMap((a) => {
          const reqs = a[0] as Array<{ appid: string; preferredImageTypes?: string[] }>
          return reqs
        })
        const result = await bridge.imageCacheBatchGet(merged)
        if (!result.success || !result.entries) {
          return batchArgs.map(() => result)
        }
        // Split the entries array back per-caller based on how many requests each contributed.
        let idx = 0
        const split: unknown[] = []
        for (const a of batchArgs) {
          const reqs = a[0] as unknown[]
          const count = reqs.length
          const slice = result.entries.slice(idx, idx + count)
          split.push({ success: true, entries: slice })
          idx += count
        }
        return split
      }

      case 'db:get-games-meta': {
        // --- batch game metadata lookups ---
        const mergedAppids: string[] = []
        const originalCounts: number[] = []
        for (const a of batchArgs) {
          const appids = a[0] as string[]
          originalCounts.push(appids.length)
          mergedAppids.push(...appids)
        }
        const metaResults = await bridge.getGamesMeta(mergedAppids)
        let metaIdx = 0
        const splitMeta: unknown[] = []
        for (const count of originalCounts) {
          splitMeta.push(metaResults.slice(metaIdx, metaIdx + count))
          metaIdx += count
        }
        return splitMeta
      }

      case 'db:batch-get-game-details': {
        // --- batch full game details ---
        // Each args entry is [ appids[] ] — merge all into one call, split results
        const mergedAppids2: string[] = []
        const originalCounts2: number[] = []
        for (const a of batchArgs) {
          const appids = a[0] as string[]
          originalCounts2.push(appids.length)
          mergedAppids2.push(...appids)
        }
        const detailsResults = await bridge.batchGetGameDetails(mergedAppids2)
        let dIdx = 0
        const splitDetails: unknown[] = []
        for (const count of originalCounts2) {
          splitDetails.push(detailsResults.slice(dIdx, dIdx + count))
          dIdx += count
        }
        return splitDetails
      }

      case 'db:batch-query-games': {
        // --- batch paginated queries ---
        // Each args entry is [ QueryGamesOpts ] — merge all query opts into one call
        const mergedOpts: QueryGamesOpts[] = []
        const originalCounts3: number[] = []
        for (const a of batchArgs) {
          const opts = a[0] as QueryGamesOpts
          mergedOpts.push(opts)
          originalCounts3.push(1) // each caller sends one opts object
        }
        const queryResults = await bridge.batchQueryGames(mergedOpts)
        let qIdx = 0
        const splitQueries: unknown[] = []
        for (const count of originalCounts3) {
          splitQueries.push(queryResults.slice(qIdx, qIdx + count))
          qIdx += count
        }
        return splitQueries
      }

      default:
        throw new Error(`IpcBatcher: no dispatch mapping for channel "${channel}"`)
    }
  }
}

interface PendingEntry {
  args: unknown[]
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

/** Singleton instance used across the app. */
export const ipcBatcher = new IpcBatcher()
