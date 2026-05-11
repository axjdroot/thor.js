const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ?
      walk(dirPath, callback) : callback(path.join(dir, f));
  });
};

const apiDir = path.join(process.cwd(), 'src/app/api');

const bindings = [
  'DB',
  'KV',
  'R2',
  'CART_DO',
  'INVENTORY_DO',
  'ORDER_QUEUE',
  'EMAIL_QUEUE',
  'AI',
  'ANALYTICS',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'CLERK_WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SECRET'
];

walk(apiDir, (filePath) => {
  if (filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    bindings.forEach(binding => {
      // Replace env.BINDING with env.BINDING! if it doesn't already have ! or is not part of a larger word
      const regex = new RegExp(`env\\.${binding}(?!!|\\w)`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, `env.${binding}!`);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  }
});
