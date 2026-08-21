const cache = new Map<string, string>()

export function getAverageColor(imageUrl: string): Promise<string> {
  if (cache.has(imageUrl)) return Promise.resolve(cache.get(imageUrl)!)

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = 1
      canvas.height = 1
      ctx.drawImage(img, 0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      const color = `rgb(${r},${g},${b})`
      cache.set(imageUrl, color)
      resolve(color)
    }

    img.onerror = () => {
      resolve('rgb(100,100,100)')
    }

    img.src = imageUrl
  })
}
