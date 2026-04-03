// SSE Client Manager - singleton to manage all connected SSE clients
type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  addClient(id: string, controller: ReadableStreamDefaultController) {
    this.clients.set(id, { id, controller });
    console.log(`SSE: Client connected. Total: ${this.clients.size}`);
  }

  removeClient(id: string) {
    this.clients.delete(id);
    console.log(`SSE: Client disconnected. Total: ${this.clients.size}`);
  }

  broadcast(data: Record<string, unknown>) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    const deadClients: string[] = [];
    this.clients.forEach((client, id) => {
      try {
        client.controller.enqueue(encoded);
      } catch {
        deadClients.push(id);
      }
    });

    deadClients.forEach((id) => this.removeClient(id));
  }

  getClientCount() {
    return this.clients.size;
  }
}

// Global singleton
const globalSSE = global as typeof global & { sseManager?: SSEManager };
if (!globalSSE.sseManager) {
  globalSSE.sseManager = new SSEManager();
}

export const sseManager = globalSSE.sseManager;
