import express, { Router } from 'express';
import { postTranscribe } from '../controllers/voice.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { AUDIO_TYPES, MAX_AUDIO_BYTES } from '../services/transcription.service.js';

/**
 * Rutas del registro por voz (se montan en `/api/v1/voice`). Exigen access token.
 * - `POST /transcribe` → el cuerpo es el audio crudo (no JSON); responde `{ text }`.
 */
const router = Router();

router.use(requireAuth);
// El token se revisa antes de leer el audio: sin sesión no se recibe ni un byte.
router.post(
  '/transcribe',
  express.raw({ type: Object.keys(AUDIO_TYPES), limit: MAX_AUDIO_BYTES }),
  postTranscribe,
);

export default router;
