import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function MailboxPanel({
  recipientId,
  unreadAtOpen,
  onClose,
}: {
  recipientId: string;
  unreadAtOpen: Set<string>;
  onClose: () => void;
}) {
  const messages = useStore((s) => s.messages);
  const own = messages.filter((m) => m.recipientId === recipientId).sort((a, b) => a.createdAt - b.createdAt);

  // Rendered into document.body: this lives inside <header>, whose backdrop-filter
  // would otherwise clip a position:fixed overlay to the header's own tiny box in
  // Chromium instead of the full viewport (same issue as the guest-join prompt).
  return createPortal(
    <div className="mailbox-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mailbox-card" onClick={(e) => e.stopPropagation()}>
        <div className="mailbox-header">
          <h3>📬 Postfach</h3>
          <button className="button-secondary mailbox-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mailbox-list">
          {own.length === 0 && <p className="hint">Noch keine Nachrichten.</p>}
          {own.map((m) => (
            <div key={m.id} className={`mailbox-msg ${unreadAtOpen.has(m.id) ? 'unread' : ''}`}>
              <p>{m.text}</p>
              <span className="mailbox-time">{formatTime(m.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Mailbox() {
  const activePlayerId = useStore((s) => s.activePlayerId);
  const messages = useStore((s) => s.messages);
  const markMessagesRead = useStore((s) => s.markMessagesRead);
  // Which ids were unread right when the panel was opened - null means closed.
  // Kept separate from the live `read` flag so the badge can clear immediately
  // on open while the panel still shows what was new this time.
  const [unreadAtOpen, setUnreadAtOpen] = useState<Set<string> | null>(null);

  if (!activePlayerId) return null;

  const unreadCount = messages.filter((m) => m.recipientId === activePlayerId && !m.read).length;

  return (
    <>
      <button
        className="mailbox-btn"
        aria-label="Postfach"
        onClick={() => {
          setUnreadAtOpen(new Set(messages.filter((m) => m.recipientId === activePlayerId && !m.read).map((m) => m.id)));
          markMessagesRead(activePlayerId);
        }}
      >
        📬
        {unreadCount > 0 && <span className="mailbox-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {unreadAtOpen && (
        <MailboxPanel recipientId={activePlayerId} unreadAtOpen={unreadAtOpen} onClose={() => setUnreadAtOpen(null)} />
      )}
    </>
  );
}
