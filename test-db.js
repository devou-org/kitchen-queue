async function main() {
  const { getOrders } = await import('./src/lib/db.ts');
  const orders = await getOrders('00000000-0000-0000-0000-000000000000', {});
  console.log("Returned orders:", orders.length);
  orders.forEach(o => console.log(o.ticket_number, o.restaurant_id));
}
main().catch(console.error);
