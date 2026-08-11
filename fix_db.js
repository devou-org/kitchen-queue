const fs = require('fs');
let code = fs.readFileSync('src/lib/db.ts', 'utf8');
code = code.replace(/SELECT\s+COUNT\(\*\)::int as total_orders,[\s\S]*?(?=FROM orders)/g, 
`SELECT 
          COUNT(*)::int as total_orders,
          COUNT(*) FILTER (WHERE status = 'PAID')::int as paid_orders,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED'), 0) as total_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE status = 'PAID'), 0) as total_paid_revenue,
          COALESCE(SUM(subtotal) FILTER (WHERE status != 'CANCELLED' AND orders.gst_type = 'REGULAR'), 0) as total_regular_subtotal,
          COALESCE(SUM(gst_amount) FILTER (WHERE status != 'CANCELLED' AND orders.gst_type = 'REGULAR'), 0) as total_regular_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND orders.gst_type = 'COMPOSITION'), 0) as total_composition_revenue,
          COALESCE(SUM(total_price * gst_rate / 100) FILTER (WHERE status != 'CANCELLED' AND orders.gst_type = 'COMPOSITION'), 0) as total_composition_gst,
          COALESCE(SUM(total_price) FILTER (WHERE status != 'CANCELLED' AND (orders.gst_type = 'NONE' OR orders.gst_type IS NULL)), 0) as total_none_revenue
        `);
fs.writeFileSync('src/lib/db.ts', code);
