import { useState } from "react";
import { useLang } from "../context/LangContext.jsx";
import styles from "./StickyChat.module.css";

const CART_LABEL = { en: "Order", ar: "الطلبات" };

function StickyButton({ label, icon, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      className={`sticky-cta-btn ${styles.chatButton} ${isHovered ? styles.hovered : ""}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={label}
      title={label}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={styles.icon}
      >
        {icon}
      </svg>
      <span className={styles.label}>{label}</span>
    </button>
  );
}

const CLOSE_ICON = (
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
);

const CART_ICON = (
  <>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </>
);

/**
 * Sticky AI Assistant + Order buttons that float at bottom-right and
 * stay visible across all pages. Both always show their label (not
 * hover-only) and swap to a close icon while their own popover is
 * open — the same persistent "Talk to Sulaiman <-> X" pattern as
 * k-g-i.com's widget toggle, rather than a full-page navigation.
 * @param {function} onChatClick - Toggles the ChatWidget popover open/closed
 * @param {boolean} chatOpen - Whether the ChatWidget popover is currently open
 * @param {function} onOrderClick - Toggles the OrderPanel popover open/closed
 * @param {boolean} orderOpen - Whether the OrderPanel popover is currently open
 * @param {boolean} isHome - True on the home page, where Hero already renders
 *   its own in-flow quick-chat box. On mobile that box sits close enough to
 *   this fixed button to collide, so the AI Assistant button is hidden there
 *   below 768px; see .homeMobileHidden in StickyChat.module.css. Desktop is
 *   unaffected, and every other page keeps the sticky buttons exactly as
 *   before.
 */
export default function StickyChat({ onChatClick, chatOpen = false, onOrderClick, orderOpen = false, isHome = false }) {
  const { copy, lang } = useLang();
  const cartLabel = CART_LABEL[lang] || CART_LABEL.en;

  return (
    <div className={styles.stickyContainer}>
      <div className={styles.chatButtonWrap}>
        <StickyButton
          label={orderOpen ? copy.common.close : cartLabel}
          onClick={() => onOrderClick?.()}
          icon={orderOpen ? CLOSE_ICON : CART_ICON}
        />
      </div>
      <div className={`${styles.chatButtonWrap} ${isHome ? styles.homeMobileHidden : ""}`}>
        <StickyButton
          label={chatOpen ? copy.common.close : copy.chat.header}
          onClick={() => onChatClick?.()}
          icon={
            chatOpen ? CLOSE_ICON : (
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            )
          }
        />
        {!chatOpen && <div className={styles.pulse} />}
        {!chatOpen && <span className={styles.onlineDot} aria-hidden="true" />}
      </div>
    </div>
  );
}
