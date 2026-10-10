export type BasketLine = { productId: string; variantId: string | null; quantity: number };
export type OrderItem = { name: string; variant?: string | null; quantity: number };
export function normalizeWhatsApp(input: string, countryCode: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]+$/.test(compact)) return null;
  if (compact.startsWith("+")) return /^\+[1-9][0-9]{7,14}$/.test(compact) ? compact : null;
  if (compact.startsWith("00")) return normalizeWhatsApp(`+${compact.slice(2)}`, countryCode);
  if (countryCode === "JM") { const digits = compact.startsWith("1") && compact.length === 11 ? compact.slice(1) : compact; return /^(876|658)[0-9]{7}$/.test(digits) ? `+1${digits}` : null; }
  if (countryCode === "GY") { const digits = compact.startsWith("592") && compact.length === 10 ? compact.slice(3) : compact; return /^[0-9]{7}$/.test(digits) ? `+592${digits}` : null; }
  return null;
}
export function orderMessage(businessName: string, items: OrderItem[]) {
  if (!items.length) throw new Error("Basket is empty");
  return `Hi ${businessName}, I'd like to order:\n\n${items.map(item => `${item.name}${item.variant ? `\n${item.variant}` : ""}\nQty: ${item.quantity}`).join("\n\n")}\n\nPlease let me know availability, final price, and the next steps.`;
}
export function whatsappLink(phone: string, businessName: string, items: OrderItem[]) { return `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(orderMessage(businessName, items))}`; }
