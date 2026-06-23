import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"

import { initialsOf } from "@/lib/format"

// The one avatar used everywhere in the app. Always round; shows the image when present,
// otherwise falls back to initials (max two letters) derived from the name — never a
// stored/possibly-empty initials field. Size via `className` (e.g. "size-7"); bump the
// fallback text for larger avatars via `fallbackClassName`.
export function UserAvatar({
  name,
  src,
  className,
  fallbackClassName,
}: {
  name: string
  src?: string | null
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={cn("text-xs", fallbackClassName)}>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  )
}
