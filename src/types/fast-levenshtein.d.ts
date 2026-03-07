declare module 'fast-levenshtein' {
  export function get(a: string, b: string, options?: { useCollator?: boolean }): number;
}
