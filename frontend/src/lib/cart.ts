import { PRODUCT_CATALOG, getProductMeta } from "@/lib/commerce";

export type Cart = Record<string, number>;

export type CartItem = ReturnType<typeof getProductMeta> & {
  quantity: number;
};

const CART_KEY = "techsphere_cart";
export const CART_UPDATED_EVENT = "techsphere-cart-updated";

export function readCart(): Cart {
  if (typeof window === "undefined") return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed as Record<string, unknown>).reduce<Cart>(
      (next, [productId, rawQuantity]) => {
        const quantity = Number(rawQuantity);
        const knownProduct = PRODUCT_CATALOG.some(
          (product) => product.id === productId,
        );

        if (knownProduct && Number.isFinite(quantity) && quantity > 0) {
          next[productId] = quantity;
        }

        return next;
      },
      {},
    );
  } catch {
    return {};
  }
}

export function writeCart(cart: Cart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function getCartItems(cart: Cart): CartItem[] {
  return Object.entries(cart)
    .map(([productId, quantity]) => ({ ...getProductMeta(productId), quantity }))
    .filter((item) => item.quantity > 0);
}

export function getCartCount(cart: Cart): number {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}

export function getCartTotal(cart: Cart): number {
  return getCartItems(cart).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
}

export function updateCartQuantity(
  cart: Cart,
  productId: string,
  quantity: number,
): Cart {
  const next = { ...cart };
  const safeQuantity = Math.max(0, Math.floor(quantity));

  if (safeQuantity === 0) {
    delete next[productId];
    return next;
  }

  next[productId] = safeQuantity;
  return next;
}

export function addToCart(productId: string, quantity = 1): Cart {
  const cart = readCart();
  const next = updateCartQuantity(
    cart,
    productId,
    (cart[productId] ?? 0) + quantity,
  );
  writeCart(next);
  return next;
}
