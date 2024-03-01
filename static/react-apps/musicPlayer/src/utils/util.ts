import { SetStateAction } from 'react'
import { Song } from '../types'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

type RequestOptions = {
  [key: string]: string | FormData
}

type FetchWrapperCallback<T> = (response: T) => void

export const fetchWrapper = <T>(
  endpoint: RequestInfo,
  method: HttpMethod,
  params: RequestOptions = {},
  headers: RequestOptions = {},
  callback: FetchWrapperCallback<T>,
): void => {
  const callParams: RequestInit = {
    headers: headers as HeadersInit,
    method: method,
    credentials: 'include',
    mode: 'same-origin',
  }

  if (params instanceof FormData) {
    callParams.body = params
  } else {
    if (method.toLowerCase() === 'post') {
      callParams.body = JSON.stringify(params)
    }
  }

  fetch(endpoint, callParams)
    .then((response) => response.text())
    .then((data) => {
      const parsedResponse = JSON.parse(data)
      callback(parsedResponse)
    })
    .catch((error) => {
      console.error(error)
    })
}

export const playAudio = (
  audioRef: React.MutableRefObject<HTMLAudioElement>,
  selectedSong: Song | null,
  setPlaying: React.Dispatch<SetStateAction<boolean>>,
) => {
  if (selectedSong) {
    const audio = audioRef.current
    audio.pause()
    if (selectedSong.url !== audio.src) {
      audio.src = selectedSong.url
    }

    audio
      .play()
      .then(() => {
        setPlaying(true)
      })
      .catch(() => {
        // Handle error eventually
      })
  }
}

export const pauseAudio = (
  audioRef: React.MutableRefObject<HTMLAudioElement>,
  setPlaying: React.Dispatch<SetStateAction<boolean>>,
) => {
  const audio = audioRef.current
  audio.pause()
  setPlaying(false)
}
