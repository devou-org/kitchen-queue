const b = require('bcryptjs');
console.log(b.hashSync('admin123', 10));
