export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

export function todayStr() {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

export function fmtCurrency(n) { return n.toFixed(2); }

export function fmtVes(n) { return 'Bs ' + Math.round(n).toLocaleString(); }

export function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function fmtDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

export function cerrarModal(id) {
  document.getElementById(id).classList.add('hidden');
}
