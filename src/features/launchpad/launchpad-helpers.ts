/** 0x1234…abcd — compact form for agent addresses in checklists and notes. */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
