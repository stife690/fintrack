/**
 * Descarga un archivo que ya está en memoria (un `Blob`) con el nombre indicado.
 *
 * Crea un enlace temporal a una URL `blob:` y lo "clickea": así funciona en Chrome, Edge,
 * Firefox y Android. En iPhone, iOS abre una vista previa con "Compartir → Guardar en Archivos".
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 */
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera después: si se revoca en el mismo instante, algunos navegadores cancelan la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
