import express, { Router } from 'express';
import {
  deleteLink,
  getLink,
  getWebhook,
  postLink,
  postWebhook,
} from '../controllers/whatsapp.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Webhook de Meta (FT-0029), montado en `/api/v1/whatsapp/webhook` antes de `express.json()`: la
 * firma se calcula sobre el cuerpo original. No usa token: lo protege esa firma.
 */
export const webhookRouter = Router();
webhookRouter.get('/', getWebhook);
webhookRouter.post('/', express.raw({ type: '*/*', limit: '1mb' }), postWebhook);

/**
 * Conexión del número (FT-0029), montada en `/api/v1/whatsapp/link`. Exige access token.
 * - `GET /` → estado · `POST /` → código para vincular · `DELETE /` → desconectar.
 */
export const linkRouter = Router();
linkRouter.use(requireAuth);
linkRouter.get('/', getLink);
linkRouter.post('/', postLink);
linkRouter.delete('/', deleteLink);
