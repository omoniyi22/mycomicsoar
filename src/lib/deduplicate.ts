export function deduplicateByKey<T>(items: T[], key: keyof T): T[] {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (value === null || value === undefined) return true; // keep items without the key
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}