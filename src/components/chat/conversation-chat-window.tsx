import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleMore, Minus, Send, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth-provider";
import {
  ChatConversationMessage,
  ChatConversationSummary,
  fetchChatConversationMessages,
  onConversationMessage,
  sendConversationMessage,
} from "@/realtime";
import { getInitials, normalizePortraitUrl } from "@/lib/character-ui";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import SplitChatAvatar from "@/components/chat/split-chat-avatar";

const DM_CHAT_AVATAR_URL = "/portraits/dm_profile.png";

function appendMessage(list: ChatConversationMessage[], message: ChatConversationMessage) {
  if (list.some((entry) => entry.id === message.id)) return list;
  return [...list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function getMessageDayKey(createdAt: string) {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMessageDayLabel(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMessageTooltip(createdAt: string) {
  return new Date(createdAt).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ConversationChatWindowProps = {
  conversation: ChatConversationSummary;
  title: string;
  subtitle?: string;
  avatarMode?: "single" | "split";
  avatarUrl?: string;
  splitAvatar?: {
    leftName: string;
    rightName: string;
    leftAvatarUrl?: string;
    rightAvatarUrl?: string;
  };
  forceReceivedLayout?: boolean;
  dmAccessNote?: string;
  className?: string;
  onClose?: () => void;
  onMinimize?: () => void;
  onIncomingMessage?: (message: ChatConversationMessage) => void;
};

export default function ConversationChatWindow({
  conversation,
  title,
  subtitle,
  avatarMode = "single",
  avatarUrl,
  splitAvatar,
  forceReceivedLayout = false,
  dmAccessNote,
  className = "",
  onClose,
  onMinimize,
  onIncomingMessage,
}: ConversationChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    void fetchChatConversationMessages(conversation.id)
      .then((thread) => {
        if (active) setMessages(Array.isArray(thread) ? thread : []);
      })
      .catch(() => {
        if (active) toast.error("Non sono riuscito a caricare la chat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const offChat = onConversationMessage((message) => {
      if (message.conversationId !== conversation.id) return;
      setMessages((prev) => appendMessage(prev, message));
      onIncomingMessage?.(message);
    });

    return () => {
      active = false;
      try {
        offChat();
      } catch {}
    };
  }, [conversation.id, onIncomingMessage]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages]
  );

  const participantBySlug = useMemo(
    () =>
      Object.fromEntries(
        conversation.participants.map((participant) => [
          participant.slug,
          {
            name: participant.name,
            avatarUrl: participant.portraitUrl ?? "",
          },
        ])
      ),
    [conversation.participants]
  );

  const normalizedAvatar = normalizePortraitUrl(avatarUrl);
  const normalizedDmAvatar = normalizePortraitUrl(DM_CHAT_AVATAR_URL);
  const hasMultipleRemoteSenders = useMemo(() => {
    const identities = new Set(
      sortedMessages
        .filter((message) => {
          const isOwnMessage = !forceReceivedLayout && message.senderUserId === user?.id;
          return !isOwnMessage;
        })
        .map((message) => `${message.senderRole}:${message.senderCharacterSlug ?? message.senderUserId ?? message.senderName}`)
    );
    return identities.size > 1;
  }, [forceReceivedLayout, sortedMessages, user?.id]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendConversationMessage({ conversationId: conversation.id, text });
    setDraft("");
  };

  const renderHeaderAvatar = () => {
    if (avatarMode === "split" && splitAvatar) {
      return (
        <SplitChatAvatar
          className="h-9 w-9"
          leftName={splitAvatar.leftName}
          rightName={splitAvatar.rightName}
          leftAvatarUrl={splitAvatar.leftAvatarUrl}
          rightAvatarUrl={splitAvatar.rightAvatarUrl}
        />
      );
    }

    return (
      <Avatar className="h-9 w-9 border border-border/50">
        {normalizedAvatar ? <AvatarImage src={normalizedAvatar} alt={title} className="object-cover" /> : null}
        <AvatarFallback className="bg-primary/10 font-heading text-sm font-bold text-primary">
          {getInitials(title)}
        </AvatarFallback>
      </Avatar>
    );
  };

  return (
    <Dialog>
      <div className={`flex h-[430px] w-[340px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur ${className}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background/75 px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            {avatarMode === "single" && normalizedAvatar ? (
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="rounded-full transition-transform hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2 focus:ring-offset-background"
                  aria-label={`Apri immagine profilo di ${title}`}
                  title="Apri immagine profilo"
                >
                  {renderHeaderAvatar()}
                </button>
              </DialogTrigger>
            ) : (
              renderHeaderAvatar()
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{title}</div>
              <div className="truncate text-xs text-muted-foreground">{subtitle || conversation.id}</div>
              {dmAccessNote ? <div className="truncate text-[10px] text-muted-foreground/80">{dmAccessNote}</div> : null}
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
          <TooltipProvider delayDuration={120}>
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
                  sortedMessages.map((message, index) => {
                    const isOwnMessage = !forceReceivedLayout && message.senderUserId === user?.id;
                    const previousMessage = sortedMessages[index - 1];
                    const nextMessage = sortedMessages[index + 1];
                    const startsNewDay =
                      !previousMessage || getMessageDayKey(previousMessage.createdAt) !== getMessageDayKey(message.createdAt);
                    const identityKey = `${message.senderRole}:${message.senderCharacterSlug ?? message.senderUserId ?? message.senderName}`;
                    const previousIdentityKey = previousMessage
                      ? `${previousMessage.senderRole}:${previousMessage.senderCharacterSlug ?? previousMessage.senderUserId ?? previousMessage.senderName}`
                      : null;
                    const nextIdentityKey = nextMessage
                      ? `${nextMessage.senderRole}:${nextMessage.senderCharacterSlug ?? nextMessage.senderUserId ?? nextMessage.senderName}`
                      : null;
                    const sameSenderAsPrevious =
                      !!previousMessage &&
                      previousIdentityKey === identityKey &&
                      getMessageDayKey(previousMessage.createdAt) === getMessageDayKey(message.createdAt);
                    const sameSenderAsNext =
                      !!nextMessage &&
                      nextIdentityKey === identityKey &&
                      getMessageDayKey(nextMessage.createdAt) === getMessageDayKey(message.createdAt);
                    const startsGroup = !sameSenderAsPrevious;
                    const endsGroup = !sameSenderAsNext;
                    const senderParticipant = message.senderCharacterSlug ? participantBySlug[message.senderCharacterSlug] : null;
                    const senderAvatarUrl = message.senderRole === "dm"
                      ? normalizedDmAvatar
                      : normalizePortraitUrl(senderParticipant?.avatarUrl);
                    const senderLabel = message.senderRole === "dm"
                      ? "Il DM interviene"
                      : senderParticipant?.name ?? message.senderCharacterName ?? message.senderName;
                    const showSenderLabel = !isOwnMessage && startsGroup && (forceReceivedLayout || hasMultipleRemoteSenders || message.senderRole === "dm");

                    return (
                      <div key={message.id} className="contents">
                        {startsNewDay ? (
                          <div className="flex justify-center pb-1 pt-2">
                            <div className="rounded-full border border-border/60 bg-background/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm">
                              {formatMessageDayLabel(message.createdAt)}
                            </div>
                          </div>
                        ) : null}

                        <div className={cn("flex items-end gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
                          {!isOwnMessage ? (
                            <div className="flex h-7 w-7 shrink-0 items-end justify-center">
                              {endsGroup ? (
                                <Avatar className="h-7 w-7 border border-border/60 shadow-sm">
                                  {senderAvatarUrl ? <AvatarImage src={senderAvatarUrl} alt={senderLabel} className="object-cover" /> : null}
                                  <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                                    {getInitials(senderLabel)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : null}
                            </div>
                          ) : null}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "max-w-[78%] px-4 py-2 text-sm shadow-sm transition-colors",
                                  isOwnMessage
                                    ? "bg-primary text-primary-foreground"
                                    : message.senderRole === "dm"
                                      ? "border border-primary/30 bg-primary/10 text-foreground italic"
                                      : "bg-[#2f3033] text-white",
                                  startsGroup && endsGroup && "rounded-[22px]",
                                  startsGroup && !endsGroup && (isOwnMessage ? "rounded-[22px_22px_8px_22px]" : "rounded-[22px_22px_22px_8px]"),
                                  !startsGroup && endsGroup && (isOwnMessage ? "rounded-[22px_8px_22px_22px]" : "rounded-[8px_22px_22px_22px]"),
                                  !startsGroup && !endsGroup && (isOwnMessage ? "rounded-[22px_8px_8px_22px]" : "rounded-[8px_22px_22px_8px]")
                                )}
                              >
                                {showSenderLabel ? (
                                  <div className={cn("mb-1 text-[11px] font-medium", message.senderRole === "dm" ? "text-primary" : "text-white/70")}>
                                    {senderLabel}
                                  </div>
                                ) : null}
                                <div className="whitespace-pre-wrap break-words">
                                  {message.senderRole === "dm" ? `"` : null}
                                  {message.text}
                                  {message.senderRole === "dm" ? `"` : null}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side={isOwnMessage ? "left" : "right"} className="text-xs">
                              {formatMessageTooltip(message.createdAt)}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TooltipProvider>
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

      {avatarMode === "single" && normalizedAvatar ? (
        <DialogContent className="max-w-[min(92vw,900px)] border-border/70 bg-background/95 p-2 shadow-2xl">
          <DialogTitle className="sr-only">Immagine profilo di {title}</DialogTitle>
          <img
            src={normalizedAvatar}
            alt={title}
            className="max-h-[85vh] w-full rounded-lg object-contain"
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
