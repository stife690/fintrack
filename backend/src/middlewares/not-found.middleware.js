// Formato único de errores de la API: { error: { code, message } }
export function notFound(_req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' },
  });
}
