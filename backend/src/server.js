import { createApp } from './app.js';
import { env } from './config/env.js';

createApp().listen(env.port, () => {
  console.log(`FinTrack API escuchando en el puerto ${env.port}`);
});
