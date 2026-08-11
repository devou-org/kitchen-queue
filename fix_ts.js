const fs = require('fs');

let code = fs.readFileSync('src/hooks/useRestaurant.ts', 'utf8');

code = code.replace(
  /rollover_time\?: string;/,
  `rollover_time?: string;
  gst_type?: 'NONE' | 'REGULAR' | 'COMPOSITION';
  gst_number?: string;
  gst_rate?: number;`
);

fs.writeFileSync('src/hooks/useRestaurant.ts', code);
