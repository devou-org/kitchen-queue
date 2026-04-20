import fetch from "node-fetch";

const URL = "http://localhost:3000/api/orders";
const PRODUCT_URL = "http://localhost:3000/api/products";
const PRODUCT_ID = "69d6bd29-f4ba-42bb-8989-338ecfa093ab";
const ORDER_QTY = 1;
const CONCURRENCY = 20;

const getProductStock = async () => {
  const res = await fetch(`${PRODUCT_URL}/${PRODUCT_ID}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || "Failed to fetch product");
  return Number(data.data.stock_quantity || 0);
};

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
          { product_id: PRODUCT_ID, quantity: ORDER_QTY, price_at_purchase: 100 }
        ]
      })
    });

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    const data = contentType.includes("application/json")
      ? JSON.parse(raw)
      : { success: false, error: `Non-JSON response: ${raw.slice(0, 120)}` };

    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { success: false, error: err.message } };
  }
};

const initialStock = await getProductStock();
const expectedMaxSuccess = Math.floor(initialStock / ORDER_QTY);

console.log(`Initial stock: ${initialStock}`);
console.log(`Order qty per request: ${ORDER_QTY}`);
console.log(`Concurrent requests: ${CONCURRENCY}`);
console.log(`Expected max successes: ${expectedMaxSuccess}`);

const results = await Promise.all(Array.from({ length: CONCURRENCY }, makeOrder));

const successCount = results.filter((r) => r.status === 201 && r.data?.success).length;
const failCount = results.length - successCount;
const finalStock = await getProductStock();

console.log("--- Result Summary ---");
console.log(`Success: ${successCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Final stock: ${finalStock}`);

for (const r of results) {
  if (r.status !== 201) {
    console.log(r.status, r.data);
  }
}