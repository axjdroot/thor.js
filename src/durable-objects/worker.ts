import { CartDurableObject } from './CartDO';
import { InventoryDurableObject } from './InventoryDO';

export { CartDurableObject, InventoryDurableObject };

export default {
  async fetch(request: Request, env: any) {
    return new Response('Thor Commerce Durable Objects Worker');
  },
};
