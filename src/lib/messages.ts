import type { Message } from '../types';

export function createMessage(recipientId: string, kind: Message['kind'], text: string): Message {
  return { id: crypto.randomUUID(), recipientId, kind, text, createdAt: Date.now(), read: false };
}

export const WELCOME_TEXT =
  'Willkommen bei ALRAM Bet! 🏓 Du kannst hier Coins einzahlen (1€ = 1 Coin) und auf die Spiele der anderen tippen - nur nicht auf dein eigenes. Am Ende wird der gesamte eingezahlte Topf passend zu deinem Erfolg ausgezahlt. In diesem Postfach bekommst du ab jetzt Bescheid, wenn jemand einzahlt oder eine deiner Wetten entschieden ist. Viel Erfolg!';
