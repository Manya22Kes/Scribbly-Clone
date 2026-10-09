import { AVATARS, AVATAR_TINTS } from '../tools'

interface Props {
  index: number
  size?: number
}

export default function Avatar({ index, size = 28 }: Props) {
  const i = Math.max(0, Math.min(AVATARS.length - 1, index))
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.6, background: AVATAR_TINTS[i] }}
    >
      {AVATARS[i]}
    </span>
  )
}
