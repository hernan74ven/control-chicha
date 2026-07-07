// Firebase Analytics event tracking
// Uses the global __logFirebaseEvent function set by the CDN script in index.html

export function trackVenta(data) {
  const log = window.__logFirebaseEvent;
  if (!log) return;
  log('venta_realizada', {
    tipo: data.tipo_producto || 'unknown',
    monto_usd: data.precio_usd || 0,
    vendedor: data.vendedor_nombre || 'sin_vendedor',
    moneda: data.moneda || 'USD',
    metodo_pago: data.metodo_pago || 'efectivo',
  });
}

export function trackBackup(docCount, durationMs) {
  const log = window.__logFirebaseEvent;
  if (!log) return;
  log('backup_sync', {
    documentos_subidos: docCount || 0,
    duracion_ms: durationMs || 0,
  });
}

export function trackAppOpen() {
  const log = window.__logFirebaseEvent;
  if (!log) return;
  log('app_open', { timestamp: new Date().toISOString() });
}

export function trackReporte(tipo) {
  const log = window.__logFirebaseEvent;
  if (!log) return;
  log('reporte_generado', { tipo_reporte: tipo || 'desconocido' });
}

export function trackAccion(accion, datos = {}) {
  const log = window.__logFirebaseEvent;
  if (!log) return;
  log('accion_usuario', { accion, ...datos });
}
