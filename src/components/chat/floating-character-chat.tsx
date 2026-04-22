import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Circle, MessageCircleMore, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import ConversationChatWindow from "@/components/chat/conversation-chat-window";
import {
  ChatContact,
  ChatConversationSummary,
  fetchChatContacts,
  fetchChatConversation,
  fetchChatConversations,
  getOrCreateDmConversation,
  getOrCreateDirectConversation,
  onConversationMessage,
  requestPresenceSnapshot,
  subscribePresence,
} from "@/realtime";
import { getInitials, normalizePortraitUrl } from "@/lib/character-ui";

const DM_CHAT_AVATAR_URL = "/portraits/dm_profile.png";
const PLAYER_CHAT_LAUNCHER_WIDTH = 300;
const FLOATING_PANEL_GAP = 16;

type OpenChatDescriptor = {
  key: string;
  conversation: ChatConversationSummary;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
};

type FloatingCharacterChatProps = {
  slug: string;
  title: string;
  avatarUrl?: string;
};

function buildConversationWindowTitle(
  conversation: ChatConversationSummary,
  currentSlug: string
) {
  if (conversation.kind === "dm-player") return "DM";
  return conversation.participants.find((participant) => participant.slug !== currentSlug)?.name ?? "Chat";
}

function buildConversationAvatarUrl(
  conversation: ChatConversationSummary,
  currentSlug: string
) {
  if (conversation.kind === "dm-player") return DM_CHAT_AVATAR_URL;
  return conversation.participants.find((participant) => participant.slug !== currentSlug)?.portraitUrl ?? "";
}

function buildConversationSubtitle(conversation: ChatConversationSummary) {
  return conversation.kind === "dm-player" ? "Chat col master" : "Chat (visibile al DM)";
}

export default function FloatingCharacterChat({ slug }: FloatingCharacterChatProps) {
  const { user } = useAuth();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [conversationMap, setConversationMap] = useState<Record<string, ChatConversationSummary>>({});
  const [onlineSlugs, setOnlineSlugs] = useState<string[]>([]);
  const [openChats, setOpenChats] = useState<OpenChatDescriptor[]>([]);
  const [minimizedChatKeys, setMinimizedChatKeys] = useState<string[]>([]);
  const [unreadKeys, setUnreadKeys] = useState<Record<string, boolean>>({});
  const canUseChat = !!user;

  useEffect(() => {
    if (!canUseChat || user?.role !== "player") return;
    let active = true;

    void fetchChatContacts().then((items) => {
      if (active) setContacts(Array.isArray(items) ? items : []);
    });

    void fetchChatConversations().then((items) => {
      if (!active) return;
      const nextMap = Object.fromEntries((Array.isArray(items) ? items : []).map((conversation) => [conversation.id, conversation]));
      setConversationMap(nextMap);
    });

    const unsubscribePresence = subscribePresence((list) => {
      setOnlineSlugs(list.filter((entry) => entry.count > 0).map((entry) => entry.slug));
    });
    requestPresenceSnapshot();

    const offConversation = onConversationMessage((message) => {
      if (message.senderUserId === user.id) return;

      const chatKey = `conversation:${message.conversationId}`;
      const isVisible = openChats.some((chat) => chat.key === chatKey) && !minimizedChatKeys.includes(chatKey);

      void (async () => {
        let conversation = conversationMap[message.conversationId];
        if (!conversation) {
          try {
            conversation = await fetchChatConversation(message.conversationId);
            if (active && conversation) {
              setConversationMap((prev) => ({ ...prev, [conversation!.id]: conversation! }));
            }
          } catch {
            return;
          }
        }
        if (!conversation) return;

        if (!isVisible) {
          setOpenChats((prev) => {
            if (prev.some((chat) => chat.key === chatKey)) return prev;
            return [
              ...prev,
              {
                key: chatKey,
                conversation,
                title: buildConversationWindowTitle(conversation, slug),
                subtitle: buildConversationSubtitle(conversation),
                avatarUrl: buildConversationAvatarUrl(conversation, slug),
              },
            ];
          });
          setMinimizedChatKeys((prev) => (prev.includes(chatKey) ? prev : [...prev, chatKey]));
          setUnreadKeys((prev) => ({ ...prev, [chatKey]: true }));
        }
      })();
    });

    return () => {
      active = false;
      try {
        unsubscribePresence();
      } catch {}
      try {
        offConversation();
      } catch {}
    };
  }, [canUseChat, conversationMap, minimizedChatKeys, openChats, slug, user]);

  const onlineContacts = useMemo(() => {
    const onlineSet = new Set(onlineSlugs);
    return contacts
      .filter((contact) => onlineSet.has(contact.slug))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  }, [contacts, onlineSlugs]);

  const openConversation = (conversation: ChatConversationSummary) => {
    const key = `conversation:${conversation.id}`;
    setOpenChats((prev) => {
      const withoutExisting = prev.filter((chat) => chat.key !== key);
      return [
        ...withoutExisting,
        {
          key,
          conversation,
          title: buildConversationWindowTitle(conversation, slug),
          avatarUrl: buildConversationAvatarUrl(conversation, slug),
          subtitle: buildConversationSubtitle(conversation),
        },
      ];
    });
    setMinimizedChatKeys((prev) => prev.filter((entry) => entry !== key));
    setUnreadKeys((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openDmConversationChat = async () => {
    const conversation = await getOrCreateDmConversation(slug);
    setConversationMap((prev) => ({ ...prev, [conversation.id]: conversation }));
    openConversation(conversation);
  };

  const openConversationChat = async (targetSlug: string) => {
    const conversation = await getOrCreateDirectConversation(slug, targetSlug);
    setConversationMap((prev) => ({ ...prev, [conversation.id]: conversation }));
    openConversation(conversation);
  };

  const minimizeChat = (chatKey: string) => {
    setMinimizedChatKeys((prev) => (prev.includes(chatKey) ? prev : [...prev, chatKey]));
  };

  const minimizeAllOpenChats = () => {
    setMinimizedChatKeys(openChats.map((chat) => chat.key));
  };

  const reopenChat = (chatKey: string) => {
    setMinimizedChatKeys((prev) => prev.filter((entry) => entry !== chatKey));
    setUnreadKeys((prev) => {
      if (!prev[chatKey]) return prev;
      const next = { ...prev };
      delete next[chatKey];
      return next;
    });
  };

  const closeChat = (chatKey: string) => {
    setOpenChats((prev) => prev.filter((chat) => chat.key !== chatKey));
    setMinimizedChatKeys((prev) => prev.filter((entry) => entry !== chatKey));
    setUnreadKeys((prev) => {
      if (!prev[chatKey]) return prev;
      const next = { ...prev };
      delete next[chatKey];
      return next;
    });
  };

  if (!canUseChat || user?.role !== "player") return null;
  if (typeof document === "undefined") return null;

  const hasUnread = Object.keys(unreadKeys).length > 0;
  const hasUnreadDmConversation = Object.entries(unreadKeys).some(([key, unread]) => {
    if (!unread) return false;
    const conversationId = key.startsWith("conversation:") ? key.slice("conversation:".length) : "";
    const conversation =
      conversationMap[conversationId] ?? openChats.find((chat) => chat.key === key)?.conversation;
    return conversation?.kind === "dm-player";
  });

  const minimizedChats = openChats.filter((chat) => minimizedChatKeys.includes(chat.key));
  const visibleChats = openChats.filter((chat) => !minimizedChatKeys.includes(chat.key));
  const visibleChatsRightOffset = launcherOpen ? 20 + PLAYER_CHAT_LAUNCHER_WIDTH + FLOATING_PANEL_GAP : 20;

  return createPortal(
    <>
      {launcherOpen ? (
        <div className="fixed bottom-20 right-5 z-[9998] w-[300px] rounded-2xl border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Chat</div>
              <div className="text-xs text-muted-foreground">Online ora</div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setLauncherOpen(false)}>
              Chiudi
            </Button>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                void openDmConversationChat();
                setLauncherOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <Avatar className="h-9 w-9 border border-border/60">
                <AvatarImage src={normalizePortraitUrl(DM_CHAT_AVATAR_URL)} alt="DM" className="object-cover" />
                <AvatarFallback className="bg-primary/10 font-bold text-primary">DM</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">DM</div>
                <div className="text-xs text-muted-foreground">Chat col master</div>
              </div>
              {hasUnreadDmConversation ? <Circle className="h-2.5 w-2.5 fill-primary text-primary" /> : null}
            </button>

            {onlineContacts.length > 0 ? (
              <div className="rounded-xl border border-border/50 bg-background/35 p-1">
                {onlineContacts.map((contact) => {
                  const normalizedAvatar = normalizePortraitUrl(contact.portraitUrl);
                  return (
                    <button
                      key={contact.slug}
                      type="button"
                      onClick={() => {
                        void openConversationChat(contact.slug);
                        setLauncherOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <Avatar className="h-9 w-9 border border-border/60">
                        {normalizedAvatar ? <AvatarImage src={normalizedAvatar} alt={contact.name} className="object-cover" /> : null}
                        <AvatarFallback className="bg-primary/10 font-bold text-primary">{getInitials(contact.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{contact.name}</div>
                        <div className="text-xs text-muted-foreground">Online</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-4 text-center text-xs text-muted-foreground">
                Nessun altro personaggio online.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {visibleChats.length > 0 ? (
        <div
          className="fixed bottom-20 z-[9997] flex max-w-[calc(100vw-3rem)] items-end gap-3 overflow-x-auto pb-2"
          style={{ right: `${visibleChatsRightOffset}px` }}
        >
          {visibleChats.map((chat) => (
            <ConversationChatWindow
              key={chat.key}
              conversation={chat.conversation}
              title={chat.title}
              subtitle={chat.subtitle}
              avatarMode="single"
              avatarUrl={chat.avatarUrl}
              dmAccessNote={chat.conversation.kind === "dm-player" ? undefined : "Visibile al DM"}
              onMinimize={() => minimizeChat(chat.key)}
              onClose={() => closeChat(chat.key)}
            />
          ))}
        </div>
      ) : null}

      <div className="fixed bottom-5 right-20 z-[9999] flex items-end gap-3">
        {openChats.map((chat) => {
          const unread = !!unreadKeys[chat.key];
          const isMinimized = minimizedChats.some((entry) => entry.key === chat.key);
          const otherParticipant = chat.conversation.participants.find((participant) => participant.slug !== slug);
          const bubbleAvatar = chat.conversation.kind === "dm-player"
            ? DM_CHAT_AVATAR_URL
            : otherParticipant?.portraitUrl;
          return (
            <div key={chat.key} className="group relative">
              <button
                type="button"
                onClick={() => reopenChat(chat.key)}
                className={`relative flex h-14 w-14 items-center justify-center rounded-full border bg-card/95 shadow-xl transition-transform hover:-translate-y-0.5 ${
                  isMinimized ? "border-border/70" : "border-primary/70 ring-2 ring-primary/20"
                }`}
                title={`Apri chat con ${chat.title}`}
                aria-label={`Apri chat con ${chat.title}`}
              >
                <Avatar className="h-12 w-12 border border-border/60">
                  {normalizePortraitUrl(bubbleAvatar) ? (
                    <AvatarImage src={normalizePortraitUrl(bubbleAvatar)} alt={chat.title} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 font-heading text-sm font-bold text-primary">
                    {getInitials(chat.title)}
                  </AvatarFallback>
                </Avatar>
                {unread ? <Circle className="absolute -right-1 -top-1 h-3 w-3 fill-primary text-primary" /> : null}
              </button>
              <button
                type="button"
                onClick={() => closeChat(chat.key)}
                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:text-foreground group-hover:flex"
                aria-label={`Chiudi chat con ${chat.title}`}
                title="Chiudi chat"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-12 w-12 rounded-full border-2 border-primary/60 bg-card text-primary shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/90"
          onClick={() =>
            setLauncherOpen((prev) => {
              const next = !prev;
              if (next) minimizeAllOpenChats();
              return next;
            })
          }
          aria-label={launcherOpen ? "Chiudi chat" : "Apri chat"}
          title={launcherOpen ? "Chiudi chat" : "Apri chat"}
        >
          <MessageCircleMore className="h-4 w-4 text-primary" />
          {hasUnread ? <Circle className="absolute -right-1 -top-1 h-3 w-3 fill-primary text-primary" /> : null}
        </Button>
      </div>
    </>,
    document.body
  );
}
