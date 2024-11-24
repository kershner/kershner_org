export type Song = {
  id: number
  title: string
  artist: string
  year: string
  type: string
  file: string
  thumbnail: string
  youtube_link: string | ''
  duration: string
  timestamp: number
}

export type Position = {
  x: number
  y: number
}
