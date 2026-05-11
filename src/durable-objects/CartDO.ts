import { DurableObject } from 'cloudflare:workers';

export class CartDurableObject extends DurableObject {
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.ctx.blockConcurrencyWhile(async () => {
      await this.setupSchema();
    });
  }

  get state() {
    return this.ctx;
  }

  async setupSchema() {
    // Durable Object Storage API for SQLite
    await this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        variant_id TEXT UNIQUE,
        product_name TEXT,
        variant_title TEXT,
        sku TEXT,
        quantity INTEGER,
        unit_price INTEGER,
        image_url TEXT,
        added_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    
    try {
      if (url.pathname === '/getCart') {
        return Response.json(await this.getCart());
      }

      if (url.pathname === '/addItem') {
        const item = await request.json();
        return Response.json(await this.addItem(item));
      }

      if (url.pathname === '/updateQuantity') {
        const { variantId, quantity } = await request.json() as any;
        return Response.json(await this.updateQuantity(variantId, quantity));
      }

      if (url.pathname === '/removeItem') {
        const { variantId } = await request.json() as any;
        return Response.json(await this.removeItem(variantId));
      }

      if (url.pathname === '/applyDiscount') {
        const { code, amount, type } = await request.json() as any;
        return Response.json(await this.applyDiscount(code, amount, type));
      }

      if (url.pathname === '/setCheckoutState') {
        const { state } = await request.json() as any;
        return Response.json(await this.setCheckoutState(state));
      }

      if (url.pathname === '/clearCart') {
        return Response.json(await this.clearCart());
      }
    } catch (e: any) {
      return new Response(e.message, { status: 500 });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async getCart() {
    const itemsRows = this.state.storage.sql.exec('SELECT * FROM items ORDER BY added_at ASC').toArray();
    const meta = await this.getMeta();
    
    let subtotal = 0;
    let itemCount = 0;
    itemsRows.forEach((item: any) => {
      subtotal += item.unit_price * item.quantity;
      itemCount += item.quantity;
    });

    const discountAmount = parseInt(meta.discountAmount || '0');
    const total = Math.max(0, subtotal - discountAmount);

    return {
      items: itemsRows,
      subtotal,
      discount: discountAmount,
      total,
      itemCount,
      discountCode: meta.discountCode || null,
      checkoutState: meta.checkoutState || 'cart',
    };
  }

  private async addItem(item: any) {
    const existing = this.state.storage.sql.exec('SELECT quantity FROM items WHERE variant_id = ?', item.variant_id).one();
    if (existing) {
      this.state.storage.sql.exec(
        'UPDATE items SET quantity = quantity + ?, added_at = ? WHERE variant_id = ?',
        item.quantity, Date.now(), item.variant_id
      );
    } else {
      this.state.storage.sql.exec(
        'INSERT INTO items (id, variant_id, product_name, variant_title, sku, quantity, unit_price, image_url, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(), item.variant_id, item.product_name, item.variant_title, item.sku, item.quantity, item.unit_price, item.image_url, Date.now()
      );
    }
    return this.getCart();
  }

  private async updateQuantity(variantId: string, quantity: number) {
    if (quantity <= 0) {
      return this.removeItem(variantId);
    }
    this.state.storage.sql.exec('UPDATE items SET quantity = ?, added_at = ? WHERE variant_id = ?', quantity, Date.now(), variantId);
    return this.getCart();
  }

  private async removeItem(variantId: string) {
    this.state.storage.sql.exec('DELETE FROM items WHERE variant_id = ?', variantId);
    return this.getCart();
  }

  private async applyDiscount(code: string, amount: number, type: string) {
    await this.setMeta('discountCode', code);
    await this.setMeta('discountAmount', amount.toString());
    await this.setMeta('discountType', type);
    return this.getCart();
  }

  private async setCheckoutState(state: string) {
    await this.setMeta('checkoutState', state);
    return this.getCart();
  }

  private async clearCart() {
    this.state.storage.sql.exec('DELETE FROM items');
    this.state.storage.sql.exec('DELETE FROM meta');
    return this.getCart();
  }

  private async getMeta() {
    const rows = this.state.storage.sql.exec('SELECT key, value FROM meta').toArray();
    const meta: Record<string, string> = {};
    rows.forEach((row: any) => {
      meta[row.key] = row.value;
    });
    return meta;
  }

  private async setMeta(key: string, value: string) {
    this.state.storage.sql.exec('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  }
}
