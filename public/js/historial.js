import { state } from './state.js';
import { api } from './api.js';
import { toast, todayStr, fmtCurrency, fmtVes, fmtDate, fmtTime } from './ui.js';
import { renderVender } from './ventas.js';

export async function cargarHistorial() {
  const desde = document.getElementById('filterDesde').value || todayStr();
  const hasta = document.getElementById('filterHasta').value || todayStr();
  const vendedor = document.getElementById('filterVendedor').value;
  let url = '/ventas?desde=' + desde + '&hasta=' + hasta;
  if (vendedor) url += '&vendedor_id=' + vendedor;

  try {
    const ventas = await api('GET', url);
    renderHistorial(ventas);
  } catch (e) {
    toast('Error al cargar historial');
  }
}

function renderHistorial(ventas) {
  const totalsEl = document.getElementById('historialTotals');
  const listEl = document.getElementById('historialList');

  if (!document.getElementById('filterDesde').value) {
    document.getElementById('filterDesde').value = todayStr();
    document.getElementById('filterHasta').value = todayStr();
  }

  const selV = document.getElementById('filterVendedor');
  selV.innerHTML = '<option value="">Todos los vendedores</option>' +
    state.vendedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');

  const totalUsd = ventas.reduce((s, x) => s + x.precio_usd, 0);
  const totalVes = ventas.reduce((s, x) => s + x.precio_ves, 0);
  const bsEf = ventas.filter(v => v.moneda === 'VES' && v.metodo_pago === 'efectivo').reduce((s, x) => s + x.precio_ves, 0);
  const bsPM = ventas.filter(v => v.moneda === 'VES' && v.metodo_pago === 'pago_movil').reduce((s, x) => s + x.precio_ves, 0);

  totalsEl.innerHTML = `
    <div class="ht-item"><div class="ht-label">Ventas</div><div class="ht-value" style="color:var(--text);">${ventas.length}</div></div>
    <div class="ht-item"><div class="ht-label">USD</div><div class="ht-value usd">$${fmtCurrency(totalUsd)}</div></div>
    <div class="ht-item"><div class="ht-label">Bs Efec.</div><div class="ht-value ves">${bsEf > 0 ? fmtVes(bsEf) : '0'}</div></div>
    <div class="ht-item"><div class="ht-label">Bs P.Movil</div><div class="ht-value ves">${bsPM > 0 ? fmtVes(bsPM) : '0'}</div></div>
  `;

  if (ventas.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No hay ventas en este periodo</div>';
    return;
  }

  function iconoPago(moneda, metodo) {
    if (moneda === 'USD') return 'USD';
    return metodo === 'pago_movil' ? 'Pago Movil' : 'Efectivo';
  }

  let html = '';
  ventas.forEach(v => {
    const vendedor = v.vendedor_nombre ? ' - ' + v.vendedor_nombre : '';
    const cliente = v.cliente_nombre ? ' - ' + v.cliente_nombre : '';
    const lugar = v.lugar ? ' ' + v.lugar : '';
    const pagoLabel = iconoPago(v.moneda, v.metodo_pago);
    const monedaLabel = v.moneda === 'USD' ? 'USD' : 'Bs';
    html += `<div class="history-item">
      <div class="hi-left">
        <div class="hi-time">${fmtDate(v.creado_en)} ${fmtTime(v.creado_en)}</div>
        <div class="hi-name">${v.producto_nombre}</div>
        <div class="hi-meta">${pagoLabel} ${monedaLabel}${vendedor}${cliente}${lugar}</div>
      </div>
      <div class="hi-right">
        <div class="hi-usd">$${fmtCurrency(v.precio_usd)}</div>
        <div class="hi-ves">${v.precio_ves > 0 ? fmtVes(v.precio_ves) : 'Bs 0'}</div>
      </div>
      <button class="hi-delete" onclick="window.eliminarVenta('${v.id}')">X</button>
    </div>`;
  });
  listEl.innerHTML = html;
}

export async function eliminarVenta(id) {
  if (!confirm('Eliminar esta venta?')) return;
  try {
    await api('DELETE', '/ventas/' + id);
    toast('Venta eliminada');
    cargarHistorial();
    renderVender();
  } catch (e) { toast('Error'); }
}


