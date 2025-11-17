import { apps, openApp } from 'open';

openApp(apps.browser, {
  arguments: [`--remote-debugging-port=9222`],
}).catch((err) => {
  console.error(`Failed to launch Chrome with remote debugging:`, err);
});
