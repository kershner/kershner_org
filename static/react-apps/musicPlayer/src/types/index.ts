export type Song = {
  id: number
  name: string
  artist: string
  year: string
  type: string
  url: string
  thumbnailUrl: string
  youtubeUrl: string | ''
  duration: string
  timestamp: number
}

export type Position = {
  x: number
  y: number
}