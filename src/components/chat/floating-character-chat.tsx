import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircleMore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import CharacterChatWindow from "@/components/chat/character-chat-window";
import { ChatMessage, joinChatRoom, onChatMessage } from "@/realtime";

type FloatingCharacterChatProps = {
  slug: string;
  title: string;
  avatarUrl?: string;
};

export default function FloatingCharacterChat({ slug, title, avatarUrl }: FloatingCharacterChatProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const canUseChat = !!user;

  useEffect(() => {
    if (!canUseChat || !user) return;

    joinChatRoom(slug);
    const offChat = onChatMessage((message: ChatMessage) => {
      if (message.slug !== slug || message.senderUserId === user.id) return;

      if (!open) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return () => {
      try {
        offChat();
      } catch {}
    };
  }, [canUseChat, open, slug, user]);

  useEffect(() => {
    if (open) {
      setUnreadCount(0);
    }
  }, [open]);

  if (!canUseChat) return null;
  if (typeof document === "undefined") return null;

  const launcher = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative h-12 w-12 rounded-full border-2 border-primary/60 bg-card text-primary shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/90"
      onClick={() => setOpen((prev) => !prev)}
      aria-label={open ? "Chiudi chat" : "Apri chat"}
      title={open ? "Chiudi chat" : "Apri chat"}
    >
      <MessageCircleMore className="h-4 w-4 text-primary" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Button>
  );

  return (
    <>
      {createPortal(
        <>
          {open ? (
            <div className="fixed bottom-20 right-5 z-[9998]">
              <CharacterChatWindow
                slug={slug}
                title={title}
                avatarUrl={avatarUrl}
                subtitle="Chat col master"
                onClose={() => setOpen(false)}
              />
            </div>
          ) : null}

          <div className="fixed bottom-5 right-20 z-[9999]">{launcher}</div>
        </>,
        document.body
      )}
    </>
  );
}
