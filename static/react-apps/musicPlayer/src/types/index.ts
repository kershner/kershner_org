export type Song = {
    id: number,
    name: string,
    artist: string,
    year: string,
    type: string,
    url: string,
    cover_art_url: string,
    youtube_url: string | null,
    duration: string,
    timestamp: number
}