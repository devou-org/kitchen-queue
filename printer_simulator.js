const net = require("net");
const os = require("os");

const PORT = parseInt(process.env.PRINTER_PORT || "9100", 10);

// Helper to get local IPv4 addresses
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const server = net.createServer((socket) => {
  const clientIP = socket.remoteAddress;
  console.log(`\n🟢 Printer connected from: ${clientIP}`);

  let data = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    data = Buffer.concat([data, chunk]);
  });

  socket.on("end", () => {
    console.log("\n==================== PRINT JOB ====================");
    console.log(`🕒 Timestamp: ${new Date().toLocaleTimeString()}`);
    console.log("---------------------------------------------------");

    // Clean up ESC/POS control codes for console readability
    const text = data
      .toString("utf8")
      .replace(/\x1B\x40/g, "[INIT]")
      .replace(/\x1B\x61[\x00-\x02]/g, "") // alignment
      .replace(/\x1D\x56[\x00-\x42]/g, "\n[✂️ PAPER CUT]\n") // cut command
      .replace(/\x1B/g, "[ESC]")
      .replace(/\x1D/g, "[GS]");

    console.log(text.trim());

    console.log("==================== END PRINT ====================");
    console.log(`✅ Received ${data.length} bytes\n`);
  });

  socket.on("error", (err) => {
    console.error("❌ Printer connection error:", err.message);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const localIPs = getLocalIPAddresses();
  console.log("==================================================");
  console.log("🖨️   Qdine Thermal Printer Simulator (ESC/POS)   ");
  console.log("==================================================");
  console.log(`Port: ${PORT}`);
  console.log("Listening on all network interfaces (0.0.0.0)");
  console.log("");
  console.log("Configure Qdine Printer in Settings / Hardware as:");
  console.log(`• Localhost (Same PC): 127.0.0.1 : ${PORT}`);
  if (localIPs.length > 0) {
    localIPs.forEach((ip) => {
      console.log(`• Network LAN IP:      ${ip} : ${PORT}`);
    });
  }
  console.log("==================================================");
  console.log("Waiting for print jobs... (Press Ctrl+C to stop)\n");
});
