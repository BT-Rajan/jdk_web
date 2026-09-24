import { useEffect, useRef, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { api } from "../../api/client.js";
import GlassPanel from "../ui/GlassPanel.jsx";
import { ChatAvatar } from "../hero/HeroShared.jsx";
import ChatMessage from "./ChatMessage.jsx";
import TypingIndicator from "./TypingIndicator.jsx";
import ChatInput from "./ChatInput.jsx";
import "./ChatWidget.css";

/**
 * Floating chat popover, docked bottom-right and layered above
 * StickyChat's toggle pill. Mirrors k-g-i.com's "Talk to Sulaiman"
 * widget: named persona + online status in the header, a starter
 * screen of tappable quick questions before the first message, and a
 * small "Powered by" credit line in the footer. Text-only — no mic
 * input or spoken replies.
 */
export default function ChatWidget({ open, onClose, initialMessage, onConsumeInitialMessage, onNavigate, onOrder }) {
  const { copy, lang, nav, branding } = useLang();
  const t = copy.chat;

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);
  const leadCapturedRef = useRef(false);

  // Resets the welcome message on mount and on every language switch.
  // Deliberately does NOT depend on `initialMessage`/`open` — that's
  // handled by the effect below — so a language change never re-sends
  // whatever quick-start message has already been consumed.
  useEffect(() => {
    setMessages([{ from: "ai", text: t.welcomeMsg }]);
    leadCapturedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Sends the hero's quick-start message (from the quick-chat box, a
  // topic card, or an example prompt — see Hero.jsx handleTopicClick /
  // handleExamplePick) once the widget is actually open and a message
  // is waiting. This has to be its own effect: the hero handoff only
  // flips `open` and `initialMessage`, it never touches `lang`, so
  // folding this into the effect above (which only watched `lang`)
  // meant clicking a topic card opened the widget but never sent
  // anything. The parent clears `initialMessage` back to "" right
  // after consuming it (see App.jsx onConsumeInitialMessage), so the
  // `initialMessage` check below is enough to prevent double-sends.
  useEffect(() => {
    if (open && initialMessage) {
      sendMessage(initialMessage);
      onConsumeInitialMessage?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, open]);

  async function sendMessage(text, historyOverride) {
    const outgoing = text.trim();
    if (!outgoing) return;
    setMessages((m) => [...m, { from: "user", text: outgoing }]);
    setDraft("");
    setTyping(true);
    const history = historyOverride ?? messages.map(({ from, text }) => ({ from, text }));
    const { reply, leadCaptured } = await api.chat(outgoing, lang, history, leadCapturedRef.current);
    leadCapturedRef.current = leadCaptured;
    setTyping(false);
    setMessages((m) => [...m, { from: "ai", text: reply }]);
  }

  // Starter screen only shows before the visitor has sent anything —
  // same moment k-g-i.com shows theirs.
  const showStarter = messages.length <= 1 && !typing;
  const starterChips = nav.slice(0, 4);

  function handleChipClick(item) {
    sendMessage(item.label);
  }

  if (!open) return null;

  return (
    <GlassPanel className="chat-widget" as="section" role="dialog" aria-modal="true" aria-label={t.header}>
      <div className="chat-widget-header">
        <div className="chat-widget-persona">
          <ChatAvatar avatarUrl={branding.chatAvatarUrl} initial={branding.siteName?.[0]} className="chat-widget-avatar" />
          <div className="chat-widget-persona-text">
            <p className="chat-widget-name">{t.header}</p>
            <p className="chat-widget-status">
              <span className="status-dot" />
              {t.onlineStatus}
            </p>
          </div>
        </div>
        <div className="chat-widget-header-actions">
          <button className="chat-widget-close" onClick={onClose} aria-label={copy.common.close}>✕</button>
        </div>
      </div>

      <div className="chat-widget-conversation" ref={scrollRef}>
        <div className="chat-messages">
          {messages.map((m, i) => (
            <ChatMessage key={i} from={m.from} text={m.text} />
          ))}
          {typing && <TypingIndicator label={copy.common.assistantTyping} />}
        </div>

        {showStarter && (
          <div className="chat-widget-starter">
            {starterChips.map((item) => (
              <button key={item.id} className="chat-widget-chip" onClick={() => handleChipClick(item)}>
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(onNavigate || onOrder) && (
        <div className="chat-widget-quick-actions">
          {onNavigate && (
            <button type="button" className="chat-widget-quick-action" onClick={() => onNavigate("products")}>
              {t.viewProductsCta}
            </button>
          )}
          {onOrder && (
            <button type="button" className="chat-widget-quick-action" onClick={onOrder}>
              {t.placeOrderCta}
            </button>
          )}
        </div>
      )}

      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={() => sendMessage(draft)}
        placeholder={t.inputPlaceholder}
        sendLabel={copy.common.send}
        disabled={typing}
      />

      <footer className="chat-widget-footer">{t.poweredBy} <span>{branding.siteName}</span></footer>
    </GlassPanel>
  );
}
