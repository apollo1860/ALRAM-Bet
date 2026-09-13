import type { Player } from '../types';

export function playerName(players: Player[], id: string | null): string {
  if (!id) return '???';
  return players.find((p) => p.id === id)?.name ?? '???';
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
