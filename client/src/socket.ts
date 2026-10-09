import { io } from 'socket.io-client'

// Same-origin by default (server serves the client). Set VITE_SERVER_URL when
// the client is hosted separately, e.g. on Vercel with the server on Render.
const serverUrl = import.meta.env.VITE_SERVER_URL as string | undefined

export const socket = serverUrl ? io(serverUrl) : io()
