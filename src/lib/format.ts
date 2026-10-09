import type { Guest, Player } from '../types';
import { BYE } from './bracket';

export function playerName(players: Player[], id: string | null, guests: Guest[] = []): string {
  if (!id) return '???';
  if (id === BYE) return 'Freilos';
  const player = players.find((p) => p.id === id);
  if (player) return player.name;
  const guest = guests.find((g) => g.id === id);
  if (guest) return `${guest.name} (Gast)`;
  return '???';
}

export function fmtCoins(n: number): string {
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 2 })} Coins`;
}

export function fmtCoinsShort(n: number): string {
  return `🪙 ${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function fmtEuro(n: number): string {
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €`;
}

export function fmtOdds(n: number): string {
  return n.toFixed(2);
}

export const ADMIN_ID = 'admin';
