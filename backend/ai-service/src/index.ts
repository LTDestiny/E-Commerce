// ==========================================
// AI Service - Main Entry Point & Controller
// ==========================================

import express, { Request, Response } from "express";
import cors from "cors";
import Redis from "ioredis";
import { GoogleGenAI } from "@google/genai";
import { config } from "./config";

// Khởi tạo các kết nối
const redisClient = new Redis(config.redis.url);
const aiClient = new GoogleGenAI({ apiKey: config.gemini.apiKey });

const app = express();
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());

// Khai báo kiểu hội thoại lưu trữ trong Redis
interface ChatMessage {
  role: "user" | "model";
  parts: [{ text: string }];
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

// Cấu trúc Schema đầu ra JSON bắt buộc cho trợ lý mua sắm AI (Structured Output)
const responseSchema = {
  type: "OBJECT",
  properties: {
    bot_response: {
      type: "STRING",
      description: "Đoạn văn bản tư vấn và thuyết phục khách hàng mua sắm bằng tiếng Việt. Luôn lịch sự, ấm áp và tự nhiên."
    },
    suggested_products: {
      type: "ARRAY",
      description: "Danh sách sản phẩm được trợ lý chọn để gợi ý thêm cho khách hàng.",
      items: {
        type: "OBJECT",
        properties: {
          productId: {
            type: "STRING",
            description: "Mã ID sản phẩm được gợi ý (Ví dụ: PROD-001)"
          },
          reason: {
            type: "STRING",
            description: "Giải thích ngắn gọn lý do vì sao sản phẩm này phù hợp với khách hàng"
          }
        },
        required: ["productId", "reason"]
      }
    },
    agent_action: {
      type: "OBJECT",
      description: "Hành động tự động mà Agent sẽ thực hiện thay mặt khách hàng. Đặt type=NONE nếu không cần thực hiện hành động nào.",
      properties: {
        type: {
          type: "STRING",
          description: "Loại hành động: ADD_TO_CART khi khách muốn mua, NONE khi chỉ tư vấn."
        },
        productId: {
          type: "STRING",
          description: "Mã ID sản phẩm cần thêm vào giỏ hàng (chỉ dùng khi type=ADD_TO_CART)"
        },
        productName: {
          type: "STRING",
          description: "Tên sản phẩm cần thêm vào giỏ hàng"
        },
        quantity: {
          type: "NUMBER",
          description: "Số lượng sản phẩm cần thêm. Mặc định 1 nếu khách không nêu rõ."
        },
        confirmMessage: {
          type: "STRING",
          description: "Thông báo xác nhận hành động đã thực hiện để hiển thị cho khách hàng."
        }
      },
      required: ["type"]
    }
  },
  required: ["bot_response", "suggested_products", "agent_action"]
};

// Hàm lấy dữ liệu sản phẩm thực tế từ Inventory Service (In-Context RAG)
async function fetchInventoryProducts(): Promise<any[]> {
  try {
    const res = await fetch(`${config.services.inventory}/api/inventory`);
    if (!res.ok) {
      throw new Error(`Inventory Service trả về status ${res.status}`);
    }
    return (await res.json()) as any[];
  } catch (error) {
    console.error("[RAG Error] Lấy dữ liệu kho thất bại, sử dụng danh sách sản phẩm dự phòng:", error);
    // Trả về dữ liệu sản phẩm mặc định làm fallback nếu service kho offline
    return [
      { productId: "PROD-001", productName: "iPhone 15 Pro Max", availableStock: 10, price: 29000000 },
      { productId: "PROD-002", productName: "Samsung Galaxy S24 Ultra", availableStock: 5, price: 26000000 },
      { productId: "PROD-003", productName: "MacBook Pro M3", availableStock: 8, price: 39000000 },
      { productId: "PROD-004", productName: "AirPods Pro 2", availableStock: 15, price: 5000000 },
      { productId: "PROD-005", productName: "iPad Air M2", availableStock: 12, price: 15000000 }
    ];
  }
}

// Các từ khoá thể hiện ý định mua hàng
const BUY_INTENT_KEYWORDS = [
  "lấy", "mua", "thêm vào giỏ", "cho mình", "cho tôi", "đặt", "order",
  "muốn mua", "muốn lấy", "muốn đặt", "chốt", "ok lấy", "được rồi lấy",
  "add", "thêm", "bỏ vào giỏ"
];

// Map từ khoá sản phẩm sang productId
const PRODUCT_KEYWORD_MAP: Array<{ keywords: string[]; productId: string; productName: string }> = [
  { keywords: ["iphone", "iphone 15", "iphone 15 pro", "iphone 15 pro max"], productId: "PROD-001", productName: "iPhone 15 Pro Max" },
  { keywords: ["samsung", "galaxy", "s24", "s24 ultra", "samsung galaxy"], productId: "PROD-002", productName: "Samsung Galaxy S24 Ultra" },
  { keywords: ["macbook", "macbook pro", "macbook m3", "mac"], productId: "PROD-003", productName: "MacBook Pro M3" },
  { keywords: ["airpods", "airpods pro", "tai nghe", "airpods pro 2"], productId: "PROD-004", productName: "AirPods Pro 2" },
  { keywords: ["ipad", "ipad air", "ipad m2", "ipad air m2", "máy tính bảng"], productId: "PROD-005", productName: "iPad Air M2" },
];

function detectBuyIntent(message: string): { hasBuyIntent: boolean; productId?: string; productName?: string; quantity: number } {
  const msgLower = message.toLowerCase();
  const hasBuyIntent = BUY_INTENT_KEYWORDS.some(kw => msgLower.includes(kw));

  if (!hasBuyIntent) return { hasBuyIntent: false, quantity: 1 };

  // Nhận diện sản phẩm từ message
  let matchedProduct: { productId: string; productName: string } | undefined;
  for (const entry of PRODUCT_KEYWORD_MAP) {
    if (entry.keywords.some(kw => msgLower.includes(kw))) {
      matchedProduct = { productId: entry.productId, productName: entry.productName };
      break;
    }
  }

  // Nhận diện số lượng (ví dụ: "2 cái", "3 chiếc")
  const quantityMatch = msgLower.match(/(\d+)\s*(cái|chiếc|cái|sp|sản phẩm)?/);
  const quantity = quantityMatch ? Math.min(parseInt(quantityMatch[1]), 10) : 1;

  return { hasBuyIntent: true, ...matchedProduct, quantity };
}

// Bộ tạo phản hồi dự phòng thông minh (khi API Gemini bị lỗi Quota 429 hoặc quá tải)
function generateMockResponse(message: string, dbProducts: any[]): { bot_response: string, suggested_products: any[], agent_action: any } {
  const msgLower = message.toLowerCase();
  let selectedProducts: any[] = [];
  let responseText = "";
  let agent_action: any = { type: "NONE" };

  // Kiểm tra ý định mua hàng trước
  const buyIntent = detectBuyIntent(message);
  if (buyIntent.hasBuyIntent && buyIntent.productId) {
    selectedProducts = dbProducts.filter(p => p.productId !== buyIntent.productId).slice(0, 2);
    responseText = `Dạ, Destiny đã thêm ${buyIntent.quantity} ${buyIntent.productName} vào giỏ hàng của quý khách rồi ạ! 🛒 Quý khách có muốn tham khảo thêm phụ kiện đi kèm không ạ?`;
    agent_action = {
      type: "ADD_TO_CART",
      productId: buyIntent.productId,
      productName: buyIntent.productName,
      quantity: buyIntent.quantity,
      confirmMessage: `Đã thêm ${buyIntent.quantity} ${buyIntent.productName} vào giỏ hàng thành công!`
    };
  } else if (msgLower.includes("iphone") || msgLower.includes("samsung") || msgLower.includes("điện thoại") || msgLower.includes("phone")) {
    selectedProducts = dbProducts.filter(p => 
      p.productName.toLowerCase().includes("iphone") || 
      p.productName.toLowerCase().includes("samsung")
    );
    responseText = "Dạ, Destiny xin chào quý khách! Cửa hàng đang có sẵn dòng sản phẩm flagship cực hot như iPhone 15 Pro Max và Samsung Galaxy S24 Ultra với cấu hình mạnh mẽ, màn hình sắc nét và camera đỉnh cao. Quý khách có muốn tham khảo chi tiết sản phẩm nào dưới đây không ạ?";
  } else if (msgLower.includes("macbook") || msgLower.includes("laptop") || msgLower.includes("máy tính")) {
    selectedProducts = dbProducts.filter(p => 
      p.productName.toLowerCase().includes("macbook") || 
      p.productName.toLowerCase().includes("pro")
    );
    responseText = "Dạ, hiện tại Destiny đang có siêu phẩm MacBook Pro M3 với thiết kế sang trọng, hiệu năng vượt trội cho mọi tác vụ đồ họa và lập trình. Tôi xin gợi ý sản phẩm này để quý khách dễ dàng lựa chọn nhé ạ!";
  } else if (msgLower.includes("tai nghe") || msgLower.includes("airpods") || msgLower.includes("âm thanh")) {
    selectedProducts = dbProducts.filter(p => 
      p.productName.toLowerCase().includes("airpods")
    );
    responseText = "Dạ, nếu quý khách đang tìm kiếm thiết bị âm thanh cao cấp thì chiếc AirPods Pro 2 chống ồn vượt trội sẽ là người bạn đồng hành hoàn hảo. Quý khách có thể xem thông tin chi tiết dưới đây ạ!";
  } else if (msgLower.includes("ipad") || msgLower.includes("máy tính bảng")) {
    selectedProducts = dbProducts.filter(p => 
      p.productName.toLowerCase().includes("ipad")
    );
    responseText = "Dạ, Destiny có sẵn iPad Air M2 siêu mỏng nhẹ, màn hình Liquid Retina sắc nét cực phù hợp cho việc học tập, giải trí hay vẽ thiết kế sáng tạo. Xin mời quý khách tham khảo nhé!";
  } else {
    selectedProducts = dbProducts.slice(0, 2);
    responseText = "Dạ, Destiny Assistant xin kính chào quý khách! Hiện tại kết nối Gemini API đang tạm thời bị quá giới hạn hạn ngạch (Quota 429), tuy nhiên tôi đã tự động chuyển sang chế độ dự phòng thông minh để hỗ trợ quý khách duyệt kho hàng thực tế. Dưới đây là các sản phẩm nổi bật nhất đang có sẵn tại cửa hàng, quý khách tham khảo nhé ạ!";
  }

  if (selectedProducts.length === 0) {
    selectedProducts = dbProducts.slice(0, 2);
  }

  const suggested_products = selectedProducts.map(p => ({
    productId: p.productId,
    reason: `Sản phẩm ${p.productName} đang sẵn hàng tại kho Destiny với giá ưu đãi.`
  }));

  return { bot_response: responseText, suggested_products, agent_action };
}

// Lắng nghe API: POST /api/ai/chat
app.post("/api/ai/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, message, cart_items } = req.body;
    
    // Đọc thông tin User ID từ API Gateway forward header (nếu đã đăng nhập)
    const userId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]) : "Khách vãng lai";

    if (!session_id || !message) {
      res.status(400).json({ error: "Thiếu session_id hoặc tin nhắn message" });
      return;
    }

    const redisKey = `ai:chat:history:${session_id}`;

    // A. Đọc lịch sử chat ngắn hạn từ Redis
    const cachedHistory = await redisClient.get(redisKey);
    let chatHistory: ChatMessage[] = cachedHistory ? JSON.parse(cachedHistory) : [];

    // B. Thực hiện lấy danh mục sản phẩm thời gian thực (In-Context RAG)
    const dbProducts = await fetchInventoryProducts();
    const formattedProducts = dbProducts
      .map(p => `- Mã SP: ${p.productId} | Tên: ${p.productName} | Còn trong kho: ${p.availableStock} | Giá: ${p.price ? p.price.toLocaleString("vi-VN") + " VND" : "Liên hệ"}`)
      .join("\n");

    // C. Chuẩn bị ngữ cảnh giỏ hàng hiện tại gửi kèm từ Frontend
    const formattedCart = cart_items && cart_items.length > 0
      ? cart_items.map((item: CartItem) => `- ${item.productName} (Số lượng: ${item.quantity})`).join("\n")
      : "Giỏ hàng hiện tại trống.";

    // D. Xây dựng System Instruction động chứa ngữ cảnh hoàn chỉnh
    const systemInstruction = `
Bạn là "Destiny Assistant" - Trợ lý tư vấn mua sắm công nghệ kiêm AI Agent chuyên nghiệp, cực kỳ nhiệt tình, ấm áp và am hiểu tâm lý khách hàng tại cửa hàng công nghệ Destiny E-Commerce.

Nhiệm vụ của bạn là giải đáp mọi thắc mắc về sản phẩm, gợi ý sản phẩm phù hợp, và tự động thực hiện hành động mua sắm thay mặt khách hàng khi được yêu cầu.

---
THÔNG TIN KHÁCH HÀNG HIỆN TẠI:
- Mã khách hàng: ${userId}
- Giỏ hàng hiện tại của khách hàng:
${formattedCart}

---
DANH MỤC SẢN PHẨM HỢP LỆ ĐANG CÓ SẴN TRONG KHO (CHỈ GỢI Ý CÁC SẢN PHẨM NÀY):
${formattedProducts}

---
HƯỚNG DẪN AGENT ACTION (RẤT QUAN TRỌNG):
Trong mỗi phản hồi, bạn PHẢI điền trường "agent_action" với một trong hai giá trị:

✅ Khi khách hàng rõ ràng muốn mua/thêm sản phẩm vào giỏ hàng (ví dụ: "lấy cho mình", "mua cái này", "thêm vào giỏ", "cho tôi", "chốt đơn", "đặt hàng", "ok mua", "được rồi lấy", "mình lấy cái") thì đặt:
  agent_action.type = "ADD_TO_CART"
  agent_action.productId = <mã ID sản phẩm khớp chính xác trong danh mục>
  agent_action.productName = <tên sản phẩm>
  agent_action.quantity = <số lượng, mặc định 1 nếu khách không nêu rõ>
  agent_action.confirmMessage = "Đã thêm [tên sản phẩm] vào giỏ hàng thành công! 🛒"
  Đồng thời, bot_response phải xác nhận hành động đã thực hiện một cách vui vẻ và gợi ý thêm phụ kiện đi kèm.

❌ Trong TẤT CẢ các trường hợp khác (chỉ hỏi, tư vấn, xem sản phẩm) thì đặt:
  agent_action.type = "NONE"

LƯU Ý QUAN TRỌNG:
- CHỈ thực hiện ADD_TO_CART với sản phẩm CÓ TRONG danh mục hợp lệ ở trên
- Nếu khách muốn mua sản phẩm không có trong danh mục, hãy từ chối khéo léo và gợi ý sản phẩm thay thế
- Số lượng tối đa 1 lần thêm là 10 sản phẩm

---
CÁC NGUYÊN TẮC NGHIÊM NGẶT (GUARDRAILS):
1. KHÔNG TỰ BỊA ĐẶT (Anti-hallucination): Chỉ được gợi ý các sản phẩm có ID khớp CHÍNH XÁC với danh sách "DANH MỤC SẢN PHẨM HỢP LỆ ĐANG CÓ SẴN TRONG KHO" ở trên. Tuyệt đối không tự bịa đặt ra tính năng, giá tiền hoặc sản phẩm không tồn tại trong hệ thống.
2. CHỈ HỖ TRỢ MUA SẮM: Tuyệt đối không trả lời các câu hỏi về chính trị, tôn giáo, toán học phức tạp, lập trình hoặc bất kỳ chủ đề nào nằm ngoài phạm vi tư vấn sản phẩm công nghệ của cửa hàng. Nếu khách hỏi ngoài lề, từ chối khéo léo: "Dạ, Destiny xin lỗi quý khách. Là trợ lý mua sắm công nghệ, tôi chỉ có thể hỗ trợ quý khách tìm kiếm sản phẩm hoặc giải đáp các thắc mắc mua sắm tại cửa hàng ạ."
3. GIỌNG ĐIỆU: Luôn xưng hô lễ phép, tự nhiên, thân thiện và ấm áp. (Ví dụ: dùng các từ ngữ "Dạ", "Kính chào quý khách", "Chúc quý khách một ngày tốt lành", "Destiny rất hân hạnh...").
4. GỢI Ý BÁN CHÉO (Cross-selling): Nếu giỏ hàng của khách đã có sẵn một sản phẩm (ví dụ iPhone), hãy khéo léo tư vấn gợi ý thêm phụ kiện tương thích (như AirPods hoặc iPad) và đưa ra lý do thuyết phục vì sao họ nên mua kèm.
`;

    // E. Gọi API Gemini 2.5 Flash, tự động fallback sang gemini-1.5-flash nếu hết hạn ngạch (429) hoặc lỗi
    let parsedResult;
    try {
      let response;
      try {
        response = await aiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            ...chatHistory,
            { role: "user", parts: [{ text: message }] }
          ],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.7,
          }
        });
      } catch (primaryError: any) {
        console.warn("[Gemini Warning] Model gemini-2.5-flash gặp lỗi hoặc hết hạn ngạch. Đang tự động chuyển hướng sang gemini-1.5-flash dự phòng...", primaryError.message);
        
        response = await aiClient.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [
            ...chatHistory,
            { role: "user", parts: [{ text: message }] }
          ],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.7,
          }
        });
      }

      const aiResponseText = response.text;
      if (!aiResponseText) {
        throw new Error("Mô hình AI phản hồi dữ liệu rỗng.");
      }
      parsedResult = JSON.parse(aiResponseText);

    } catch (geminiError: any) {
      console.warn("[Gemini Quota Blocked] Cả 2 model đều gặp lỗi hạn ngạch (429). Kích hoạt chế độ Trợ lý Dự phòng Kho hàng thực tế.", geminiError.message);
      parsedResult = generateMockResponse(message, dbProducts);
    }

    // F. Cập nhật lịch sử chat mới vào Redis và lưu giữ tối đa 10 tin nhắn (Sliding Window)
    chatHistory.push({ role: "user", parts: [{ text: message }] });
    chatHistory.push({ role: "model", parts: [{ text: parsedResult.bot_response }] });

    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }

    // Lưu lại vào Redis với thời gian sống (TTL) 30 phút (1800 giây)
    await redisClient.setex(redisKey, 1800, JSON.stringify(chatHistory));

    // G. Trả phản hồi chuẩn về cho client (bao gồm agent_action)
    res.json({
      ok: true,
      bot_response: parsedResult.bot_response,
      suggested_products: parsedResult.suggested_products,
      agent_action: parsedResult.agent_action ?? { type: "NONE" }
    });

  } catch (error) {
    console.error("[AI Chat Router Error] Lỗi xử lý nghiêm trọng:", error);
    res.status(500).json({
      error: "Hệ thống trợ lý ảo đang bận, xin vui lòng thử lại sau.",
      detail: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Khởi tạo API Health check
app.get("/health", (_req, res) => {
  res.json({
    service: config.serviceName,
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(config.port, () => {
  console.log(`🤖 Dịch vụ ${config.serviceName} đang chạy thành công tại http://localhost:${config.port}`);
  if (!config.gemini.apiKey) {
    console.warn("⚠️ [CẢNH BÁO]: Chưa cấu hình khóa GEMINI_API_KEY trong file môi trường! Các truy vấn chat với AI sẽ bị thất bại.");
  }
});
