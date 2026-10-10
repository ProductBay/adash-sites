import { describe, expect, it } from "vitest";
import { normalizeWhatsApp, orderMessage, whatsappLink } from "./whatsapp";
describe("WhatsApp ordering", () => {
  it("normalizes Jamaica and Guyana separately", () => { expect(normalizeWhatsApp("(876) 555-0123", "JM")).toBe("+18765550123"); expect(normalizeWhatsApp("555 0123", "GY")).toBe("+5925550123"); expect(normalizeWhatsApp("555 0123", "JM")).toBeNull(); expect(normalizeWhatsApp("+447700900123", "JM")).toBe("+447700900123"); });
  it("rejects malformed numbers", () => { expect(normalizeWhatsApp("+1abc", "JM")).toBeNull(); expect(normalizeWhatsApp("+00000000", "JM")).toBeNull(); });
  it("encodes apostrophes, accents, variants, quantities and newlines", () => { const url = whatsappLink("+18765550123", "A’Dash Café", [{ name: "Mango Passion", variant: "16 oz", quantity: 2 }]); expect(url).toContain("wa.me/18765550123"); expect(decodeURIComponent(url.split("?text=")[1])).toBe("Hi A’Dash Café, I'd like to order:\n\nMango Passion\n16 oz\nQty: 2\n\nPlease let me know availability, final price, and the next steps."); expect(() => orderMessage("Shop", [])).toThrow(); });
});
