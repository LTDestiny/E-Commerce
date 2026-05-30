import { PRODUCT_CATALOG, getProductMeta } from "@/lib/commerce";

export type Cart = Record<string, number>;

export type CartItem = ReturnType<typeof getProductMeta> & {
  quantity: number;
};

const CART_KEY = "techsphere_cart";
const GUEST_CART_KEY = "techsphere_cart:guest";
const USER_CART_PREFIX = "techsphere_cart:user:";
const AUTH_USER_KEY = "techsphere_auth_user";
export const CART_UPDATED_EVENT = "techsphere-cart-updated";

function notifyCartUpdated() {
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

function getStoredUserId() {
  if (typeof window === "undefined") return null;

  try {
    const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
    if (!rawUser) return null;

    const user = JSON.parse(rawUser) as { id?: unknown };
    if (typeof user.id === "string" && user.id.trim()) return user.id;
    if (typeof user.id === "number" && Number.isFinite(user.id)) {
      return String(user.id);
    }

    return null;
  } catch {
    return null;
  }
}

function getUserCartKey(userId: string) {
  return `${USER_CART_PREFIX}${userId}`;
}

function getActiveCartKey() {
  const userId = getStoredUserId();
  return userId ? getUserCartKey(userId) : GUEST_CART_KEY;
}

function parseCart(raw: string | null): Cart {
  try {
    const parsed = JSON.parse(raw || "{}");
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

function readCartByKey(key: string): Cart {
  if (typeof window === "undefined") return {};
  return parseCart(window.localStorage.getItem(key));
}

function writeCartByKey(key: string, cart: Cart) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(cart));
}

export function readCart(): Cart {
  if (typeof window === "undefined") return {};

  const activeCartKey = getActiveCartKey();

  if (activeCartKey === GUEST_CART_KEY) {
    const legacyCart = readCartByKey(CART_KEY);
    if (Object.keys(legacyCart).length > 0) {
      const guestCart = readCartByKey(GUEST_CART_KEY);
      const mergedGuestCart = mergeCarts(guestCart, legacyCart);
      writeCartByKey(GUEST_CART_KEY, mergedGuestCart);
      window.localStorage.removeItem(CART_KEY);
      return mergedGuestCart;
    }
  }

  return readCartByKey(activeCartKey);
}

export function writeCart(cart: Cart) {
  if (typeof window === "undefined") return;
  writeCartByKey(getActiveCartKey(), cart);
  notifyCartUpdated();
}

function mergeCarts(baseCart: Cart, incomingCart: Cart): Cart {
  return Object.entries(incomingCart).reduce<Cart>(
    (next, [productId, quantity]) =>
      updateCartQuantity(next, productId, (next[productId] ?? 0) + quantity),
    { ...baseCart },
  );
}

export function mergeGuestCartIntoUser(userId: string | number) {
  if (typeof window === "undefined") return;

  const normalizedUserId = String(userId).trim();
  if (!normalizedUserId) return;

  const userCartKey = getUserCartKey(normalizedUserId);
  const guestCart = readCartByKey(GUEST_CART_KEY);
  const legacyCart = readCartByKey(CART_KEY);
  const cartToMerge = mergeCarts(guestCart, legacyCart);

  if (Object.keys(cartToMerge).length > 0) {
    writeCartByKey(userCartKey, mergeCarts(readCartByKey(userCartKey), cartToMerge));
  }

  window.localStorage.removeItem(GUEST_CART_KEY);
  window.localStorage.removeItem(CART_KEY);
  notifyCartUpdated();
}

export function clearGuestCart() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(GUEST_CART_KEY);
  window.localStorage.removeItem(CART_KEY);
  notifyCartUpdated();
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
