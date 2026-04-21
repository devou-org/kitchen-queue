import fetch from "node-fetch";

const URL = "https://renjzkitchen.quickserve.devou.in/api/orders";
const PRODUCT_ID = "7f41a2ad-fd99-4cb5-a7b5-bda6a53d1a37";

const makeOrder = async () => {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: "test",
        phone: "9999999999",
        total_price: 100,
        items: [
          { product_id: PRODUCT_ID, quantity: 1, price_at_purchase: 100 }
        ]
      })
    });

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    const data = contentType.includes("application/json")
      ? JSON.parse(raw)
      : { success: false, error: `Non-JSON response: ${raw.slice(0, 120)}` };

    console.log(res.status, data);
  } catch (err) {
    console.error("Error:", err.message);
  }
};

// 🔥 fire 20 concurrent requests
await Promise.all(Array.from({ length: 20 }, makeOrder));