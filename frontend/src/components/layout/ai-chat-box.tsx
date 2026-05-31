"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquareCode, X, Send, ShoppingCart, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { aiApi, getStoredUser } from "@/lib/api";
import { readCart, getCartItems, addToCart } from "@/lib/cart";

interface Message {
  role: "user" | "bot";
  text: string;
  suggestedProducts?: Array<{ productId: string; reason: string }>;
}

export function AIChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "Destiny xin kính chào quý khách! Tôi là Trợ lý Mua sắm thông minh của bạn. Hôm nay tôi có thể giúp gì cho bạn? (Ví dụ: 'Tư vấn điện thoại chơi game tốt', 'Gợi ý phụ kiện đi kèm giỏ hàng hiện tại...')"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Khởi tạo sessionId duy nhất cho mỗi phiên làm việc (Session)
  useEffect(() => {
    let storedSessionId = window.localStorage.getItem("techsphere_ai_session_id");
    if (!storedSessionId) {
      storedSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      window.localStorage.setItem("techsphere_ai_session_id", storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userQuery = message.trim();
    setMessage("");

    // 1. Thêm tin nhắn của User vào danh sách hiển thị
    const userMessage: Message = { role: "user", text: userQuery };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 2. Thu thập giỏ hàng thực tế từ localStorage
      const activeCart = readCart();
      const rawCartItems = getCartItems(activeCart);
      const cartItemsPayload = rawCartItems.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      // 3. Gửi truy vấn đến API Gateway
      const res = await aiApi.chat({
        session_id: sessionId,
        message: userQuery,
        cart_items: cartItemsPayload
      });

      // 4. Thêm câu trả lời của Bot (đã bao gồm đề xuất SP) vào giao diện
      if (res.ok) {
        setMessages(prev => [...prev, {
          role: "bot",
          text: res.bot_response,
          suggestedProducts: res.suggested_products
        }]);
      } else {
        throw new Error("Lỗi phản hồi API");
      }
    } catch (error) {
      console.error("[AI Chat Window Error]:", error);
      setMessages(prev => [...prev, {
        role: "bot",
        text: "Dạ, Destiny xin lỗi quý khách. Hệ thống tư vấn ảo hiện đang gặp gián đoạn kết nối, quý khách vui lòng thử lại sau giây lát ạ!"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (productId: string, productName: string) => {
    addToCart(productId, 1);
    alert(`Đã thêm 1 sản phẩm "${productName}" vào giỏ hàng thành công! 🛒`);
  };

  const handleResetChat = () => {
    if (confirm("Bạn có muốn làm mới cuộc trò chuyện và bắt đầu phiên tư vấn mới?")) {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      window.localStorage.setItem("techsphere_ai_session_id", newSessionId);
      setSessionId(newSessionId);
      setMessages([
        {
          role: "bot",
          text: "Destiny đã sẵn sàng tư vấn phiên mới! Quý khách có thể hỏi bất kỳ câu hỏi nào về sản phẩm công nghệ hoặc nhờ tôi phân tích giỏ hàng để giới thiệu phụ kiện đi kèm phù hợp."
        }
      ]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">
      {/* 1. KHUNG CHAT (CHỈ HIỂN THỊ KHI OPEN) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="mb-4 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-md"
          >
            {/* Header của Khung Chat */}
            <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground shadow-inner">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <span className="absolute -right-0.5 -bottom-0.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 border-2 border-primary"></span>
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm tracking-wide">Destiny Assistant</h3>
                  <p className="text-[10.5px] text-primary-foreground/75 font-medium">Trợ lý ảo Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetChat}
                  title="Làm mới cuộc trò chuyện"
                  className="rounded-lg p-1 text-primary-foreground/85 hover:bg-primary-foreground/10 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-primary-foreground/85 hover:bg-primary-foreground/10 transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Vùng tin nhắn (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 scrollbar-thin">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} space-y-1.5`}
                >
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-1">
                    {msg.role === "user" ? "BẠN" : "DESTINY ASSISTANT"}
                  </span>
                  
                  {/* Bong bóng chat văn bản */}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-card text-card-foreground border border-border/40 rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>

                  {/* Phần hiển thị Sản phẩm được gợi ý */}
                  {msg.role === "bot" && msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                    <div className="mt-2.5 w-[90%] space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/95 px-1">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span>Sản phẩm khuyên dùng:</span>
                      </div>
                      
                      <div className="space-y-2">
                        {msg.suggestedProducts.map((prod, pIdx) => (
                          <div
                            key={pIdx}
                            className="flex flex-col rounded-xl border border-border/60 bg-card p-3 shadow-sm hover:border-primary/40 hover:shadow transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-card-foreground">
                                Mã sản phẩm: {prod.productId}
                              </span>
                              <button
                                onClick={() => handleAddToCart(prod.productId, prod.productId)}
                                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                              >
                                <span>Thêm giỏ hàng</span>
                              </button>
                            </div>
                            {prod.reason && (
                              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/90 italic">
                                💡 {prod.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Indicator đang xử lý */}
              {isLoading && (
                <div className="flex flex-col items-start space-y-1.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-1">
                    DESTINY ASSISTANT
                  </span>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-border/40 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Trợ lý đang suy nghĩ và phân tích...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input gửi tin nhắn */}
            <form onSubmit={handleSendMessage} className="flex border-t border-border bg-card p-2.5">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                disabled={isLoading}
                placeholder="Dạ, quý khách muốn hỏi gì ạ?"
                className="flex-1 rounded-xl bg-muted px-4 py-2 text-sm text-foreground placeholder-muted-foreground/75 border border-transparent focus:border-primary/30 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!message.trim() || isLoading}
                className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. ICON BẬT/TẮT FLOATING BUTTON */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl hover:bg-primary/95 focus:outline-none"
        title="Trợ lý mua sắm AI"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <X className="h-6.5 w-6.5" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative flex items-center justify-center"
            >
              <MessageSquareCode className="h-6.5 w-6.5" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 border border-primary"></span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
