import { DurableObject } from 'cloudflare:workers';

export class InventoryDurableObject extends DurableObject {
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.ctx.blockConcurrencyWhile(async () => {
      await this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS stock (
          variant_id TEXT PRIMARY KEY,
          quantity INTEGER,
          reserved INTEGER
        );
      `);
    });
  }

  get state() {
    return this.ctx;
  }

  // RPC Methods
  async initialize(variantId: string, quantity: number) {
    this.state.storage.sql.exec(
      'INSERT OR REPLACE INTO stock (variant_id, quantity, reserved) VALUES (?, ?, ?)',
      variantId, quantity, 0
    );
    return { success: true };
  }

  async getAvailable(variantId: string) {
    const row = this.state.storage.sql.exec('SELECT quantity, reserved FROM stock WHERE variant_id = ?', variantId).one();
    if (!row) return 0;
    return (row.quantity as number) - (row.reserved as number);
  }

  async getReserved(variantId: string) {
    const row = this.state.storage.sql.exec('SELECT reserved FROM stock WHERE variant_id = ?', variantId).one();
    if (!row) return 0;
    return row.reserved as number;
  }

  async setTotal(variantId: string, newTotal: number) {
    const updated = this.state.storage.sql.exec(
      'UPDATE stock SET quantity = ? WHERE variant_id = ?',
      newTotal, variantId
    );
    
    if (updated.rowsWritten === 0) {
      this.state.storage.sql.exec(
        'INSERT OR REPLACE INTO stock (variant_id, quantity, reserved) VALUES (?, ?, 0)',
        variantId, newTotal
      );
    }
    return { success: true };
  }

  async reserve(variantId: string, quantity: number) {
    const row = this.state.storage.sql.exec('SELECT quantity, reserved FROM stock WHERE variant_id = ?', variantId).one();
    if (!row) return { success: false, available: 0 };
    
    const available = (row.quantity as number) - (row.reserved as number);
    if (available >= quantity) {
      this.state.storage.sql.exec('UPDATE stock SET reserved = reserved + ? WHERE variant_id = ?', quantity, variantId);
      return { success: true, available: available - quantity };
    }
    return { success: false, available };
  }

  async commit(variantId: string, quantity: number) {
    this.state.storage.sql.exec(
      'UPDATE stock SET quantity = quantity - ?, reserved = reserved - ? WHERE variant_id = ?',
      quantity, quantity, variantId
    );
    return { success: true };
  }

  async release(variantId: string, quantity: number) {
    this.state.storage.sql.exec('UPDATE stock SET reserved = reserved - ? WHERE variant_id = ?', quantity, variantId);
    return { success: true };
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    let body: any = {};
    try {
        body = await request.json();
    } catch (e) {}

    try {
      if (url.pathname === '/initialize') return Response.json(await this.initialize(body.variantId, body.quantity));
      if (url.pathname === '/getAvailable') return Response.json({ available: await this.getAvailable(body.variantId) });
      if (url.pathname === '/reserve') return Response.json(await this.reserve(body.variantId, body.quantity));
      if (url.pathname === '/commit') return Response.json(await this.commit(body.variantId, body.quantity));
      if (url.pathname === '/release') return Response.json(await this.release(body.variantId, body.quantity));
      if (url.pathname === '/setTotal' || url.pathname === '/setQuantity') return Response.json(await this.setTotal(body.variantId, body.quantity));
    } catch (e: any) {
      return new Response(e.message, { status: 500 });
    }

    return new Response('Not Found', { status: 404 });
  }
}
