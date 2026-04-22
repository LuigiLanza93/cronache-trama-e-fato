import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials, normalizePortraitUrl } from "@/lib/character-ui";

type SplitChatAvatarProps = {
  leftName: string;
  rightName: string;
  leftAvatarUrl?: string | null;
  rightAvatarUrl?: string | null;
  className?: string;
};

function AvatarHalf({
  name,
  avatarUrl,
  side,
}: {
  name: string;
  avatarUrl?: string | null;
  side: "left" | "right";
}) {
  const normalizedAvatar = normalizePortraitUrl(avatarUrl);
  return (
    <div className={cn("absolute inset-y-0 w-1/2 overflow-hidden", side === "left" ? "left-0" : "right-0")}>
      <Avatar className="h-full w-full rounded-none">
        {normalizedAvatar ? <AvatarImage src={normalizedAvatar} alt={name} className="h-full w-full object-cover" /> : null}
        <AvatarFallback className="rounded-none bg-primary/10 text-[10px] font-bold text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

export default function SplitChatAvatar({
  leftName,
  rightName,
  leftAvatarUrl,
  rightAvatarUrl,
  className,
}: SplitChatAvatarProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-full border border-border/60 bg-muted", className)}>
      <AvatarHalf name={leftName} avatarUrl={leftAvatarUrl} side="left" />
      <AvatarHalf name={rightName} avatarUrl={rightAvatarUrl} side="right" />
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-background/70" />
    </div>
  );
}
