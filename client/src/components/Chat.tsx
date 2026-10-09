import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  placeholder: string
  onSend: (text: string) => void
}

export default function Chat({ messages, placeholder, onSend }: Props) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.kind}`}>
            {m.playerName && <b>{m.playerName}: </b>}
            {m.text}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <input
          value={text}
          maxLength={100}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
      </form>
    </div>
  )
}
