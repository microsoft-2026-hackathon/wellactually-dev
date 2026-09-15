export function descriptionKey(productId: string, language: string): string {
  return `${productId}:${language}`;
}
