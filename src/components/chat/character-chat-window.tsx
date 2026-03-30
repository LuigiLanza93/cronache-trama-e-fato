import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleMore, Minus, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/auth-provider";
import { ChatMessage, fetchChatMessages, joinChatRoom, onChatMessage, sendChatMessage } from "@/realtime";
import { getInitials, normalizePortraitUrl } from "@/lib/character-ui";
import { toast } from "@/components/ui/sonner";

function appendMessage(list: ChatMessage[], message: ChatMessage) {
  if (list.some((entry) => entry.id === message.id)) return list;
  return [...list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

type CharacterChatWindowProps = {
  slug: string;
  title: string;
  avatarUrl?: string;
  subtitle?: string;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onIncomingMessage?: (message: ChatMessage) => void;
};

export default function CharacterChatWindow({
  slug,
  title,
  avatarUrl,
  subtitle,
  className = "",
  onClose,
  onMinimize,
  onIncomingMessage,
}: CharacterChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    void fetchChatMessages(slug)
      .then((thread) => {
        if (active) setMessages(Array.isArray(thread) ? thread : []);
      })
      .catch(() => {
        if (active) toast.error("Non sono riuscito a caricare la chat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    joinChatRoom(slug);
    const offChat = onChatMessage((message) => {
      if (message.slug !== slug) return;
      setMessages((prev) => appendMessage(prev, message));
      onIncomingMessage?.(message);
    });

    return () => {
      active = false;
      try {
        offChat();
      } catch {}
    };
  }, [slug, onIncomingMessage]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    sendChatMessage({ slug, text });
    setDraft("");
  };

  const normalizedAvatar = normalizePortraitUrl(avatarUrl);

  return (
    <div className={`flex h-[430px] w-[340px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background/75 px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-9 w-9 border border-border/50">
            {normalizedAvatar ? <AvatarImage src={normalizedAvatar} alt={title} className="object-cover" /> : null}
            <AvatarFallback className="bg-primary/10 font-heading text-sm font-bold text-primary">
              {getInitials(title)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{title}</div>
            <div className="truncate text-xs text-muted-foreground">{subtitle || slug}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onMinimize ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onMinimize}
            >
              <Minus className="h-4 w-4" />
            </Button>
          ) : null}
          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-background/40">
        <ScrollArea ref={scrollAreaRef} className="h-full min-h-0">
          <div className="flex min-h-full flex-col gap-3 px-3 py-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carico la conversazione...</div>
            ) : sortedMessages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <MessageCircleMore className="h-7 w-7 text-primary/70" />
                <div>
                  Nessun messaggio ancora.
                  <br />
                  Inizia la conversazione qui.
                </div>
              </div>
            ) : (
              sortedMessages.map((message) => {
                const isOwnMessage = message.senderUserId === user?.id;
                return (
                  <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-[22px] px-4 py-2 text-sm shadow-sm ${
                        isOwnMessage
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/60 bg-card text-foreground"
                      }`}
                    >
                      {!isOwnMessage ? (
                        <div className="mb-1 text-[11px] font-medium text-muted-foreground">{message.senderName}</div>
                      ) : null}
                      <div className="whitespace-pre-wrap break-words">{message.text}</div>
                      <div className={`mt-1 text-[10px] ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(message.createdAt).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-border/60 bg-background/80 p-3">
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-2 py-1.5">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Scrivi un messaggio..."
            className="h-8 border-0 bg-transparent px-2 py-0 shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" className="h-8 w-8 rounded-full" disabled={!draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
