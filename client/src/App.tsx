import { useCallback, useEffect, useState } from 'react'
import { socket } from './socket'
import type { ChatMessage, GameState, ViewState } from './types'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Game from './pages/Game'

export default function App() {
  const [state, setState] = useState<ViewState | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toast, setToast] = useState('')
  const [name, setName] = useState(() => localStorage.getItem('scribbly-name') ?? '')
  const [avatar, setAvatar] = useState(() => Number(localStorage.getItem('scribbly-avatar') ?? 0) || 0)

  useEffect(() => {
    const onState = (next: GameState) => {
      const deadline = next.timeLeft != null ? Date.now() + next.timeLeft : null
      setState({ ...next, deadline })
    }
    const onChat = (message: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-199), message])
    }
    const onError = (message: string) => setToast(message)
    const onKicked = (message: string) => {
      setState(null)
      setMessages([])
      setToast(message)
      window.history.replaceState(null, '', window.location.pathname)
    }
    const onGuessResult = (result: { correct: boolean; playerId: string; points: number }) => {
      if (result.correct && result.playerId === socket.id) setToast(`Correct! +${result.points} points`)
    }

    const onDisconnect = () => {
      setState(null)
      setMessages([])
      setToast('Disconnected from the server')
      window.history.replaceState(null, '', window.location.pathname)
    }

    socket.on('game_state', onState)
    socket.on('disconnect', onDisconnect)
    socket.on('chat_message', onChat)
    socket.on('error_msg', onError)
    socket.on('kicked', onKicked)
    socket.on('guess_result', onGuessResult)
    return () => {
      socket.off('game_state', onState)
      socket.off('disconnect', onDisconnect)
      socket.off('chat_message', onChat)
      socket.off('error_msg', onError)
      socket.off('kicked', onKicked)
      socket.off('guess_result', onGuessResult)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const enterRoom = useCallback((event: string, payload: object) => {
    setMessages([])
    socket.emit(event, payload)
  }, [])

  const leaveRoom = useCallback(() => {
    socket.emit('leave_room')
    setState(null)
    setMessages([])
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const saveName = (value: string) => {
    setName(value)
    localStorage.setItem('scribbly-name', value)
  }

  const saveAvatar = (value: number) => {
    setAvatar(value)
    localStorage.setItem('scribbly-avatar', String(value))
  }

  let screen
  if (!state) {
    screen = (
      <Home name={name} onNameChange={saveName} avatar={avatar} onAvatarChange={saveAvatar} enterRoom={enterRoom} />
    )
  } else if (state.phase === 'lobby') {
    screen = <Lobby state={state} messages={messages} onLeave={leaveRoom} />
  } else {
    screen = <Game state={state} messages={messages} onLeave={leaveRoom} />
  }

  return (
    <>
      {screen}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
