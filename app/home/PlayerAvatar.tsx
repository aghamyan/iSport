import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const SIZE_CLASSES = {
  sm: 'size-6 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-sm',
  xl: 'size-16 text-lg',
} as const

export function initialsFor(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function PlayerAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
  ring = false,
}: {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZE_CLASSES
  className?: string
  ring?: boolean
}) {
  return (
    <Avatar className={cn(SIZE_CLASSES[size], ring && 'ring-2 ring-offset-2 ring-offset-background ring-primary', className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className="font-heading font-bold">{initialsFor(name || '?')}</AvatarFallback>
    </Avatar>
  )
}
