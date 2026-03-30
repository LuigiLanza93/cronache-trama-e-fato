import { matchPath, useLocation } from "react-router-dom";
import FloatingCharacterChat from "@/components/chat/floating-character-chat";
import { useAuth } from "@/components/auth-provider";

const RESERVED_ROUTES = new Set(["login", "change-password", "dm", "characters"]);

export default function RouteCharacterChat() {
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading || !user) return null;

  const match = matchPath("/:character", location.pathname);
  const slug = match?.params.character;

  if (!slug || RESERVED_ROUTES.has(slug)) return null;

  return <FloatingCharacterChat slug={slug} title={slug} />;
}
