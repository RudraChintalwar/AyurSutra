import fs from 'fs';
import('./src/index.js').catch(e => {
  fs.writeFileSync('error.txt', e.message + '\n' + e.stack);
});
