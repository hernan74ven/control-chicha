import { state } from './state.js';
import { api } from './api.js';
import { toast, todayStr, fmtCurrency, fmtVes, fmtDate, fmtTime } from './ui.js';
import { renderHeader, renderVender } from './ventas.js';

export async function cargarHistorial() {
  const desde = document.getElementById('filterDesde').value || todayStr();
  const hasta = document.getElementById('filterHasta').value || todayStr();
  const vendedor = document.getElementById('filterVendedor').value;
  const punto = document.getElementById('filterPunto').value;
  let url = '/ventas?desde=' + desde + '&hasta=' + hasta;
  if (vendedor) url += '&vendedor_id=' + vendedor;

  try {
    const [ventas, dias] = await Promise.all([
      api('GET', url),
      api('GET', `/dias?desde=${desde}&hasta=${hasta}`)
    ]);
    const ventasFiltradas = punto ? ventas.filter(v => v.lugar === punto) : ventas;
    const diasFiltrados = punto ? dias.filter(d => d.punto === punto) : dias;
    renderHistorial(ventasFiltradas, diasFiltrados);
    renderHeader().catch(() => {});
  } catch (e) {
    console.error('Error cargarHistorial:', e);
    toast('Error al cargar historial: ' + (e.message || ''));
  }
}

function renderHistorial(ventas, dias) {
  const totalsEl = document.getElementById('historialTotals');
  const listEl = document.getElementById('historialList');

  if (!document.getElementById('filterDesde').value) {
    document.getElementById('filterDesde').value = todayStr();
    document.getElementById('filterHasta').value = todayStr();
  }

  const selV = document.getElementById('filterVendedor');
  selV.innerHTML = '<option value="">Todos los vendedores</option>' +
    state.vendedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');
  const selP = document.getElementById('filterPunto');
  selP.innerHTML = '<option value="">Todos los puntos</option>' +
    (state.puntos || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');

  const totalUsd = ventas.reduce((s, x) => s + x.precio_usd, 0);
  const totalVes = ventas.reduce((s, x) => s + x.precio_ves, 0);
  const chichasUsd = ventas.filter(v => v.moneda === 'USD' && v.tipo_producto === 'chicha').length;
  const bsEf = ventas.filter(v => v.moneda === 'VES' && (v.metodo_pago === 'efectivo' || v.metodo_pago === 'mixto'))
    .reduce((s, v) => s + (v.efectivo_bs || (v.metodo_pago === 'efectivo' ? v.precio_ves : 0)), 0);
  const bsPM = ventas.filter(v => v.moneda === 'VES' && (v.metodo_pago === 'pago_movil' || v.metodo_pago === 'mixto'))
    .reduce((s, v) => s + (v.pagomovil_bs || (v.metodo_pago === 'pago_movil' ? v.precio_ves : 0)), 0);

  totalsEl.innerHTML = `
    <div class="ht-item"><div class="ht-label">Ventas</div><div class="ht-value" style="color:var(--text);">${ventas.length}</div></div>
    <div class="ht-item"><div class="ht-label">USD</div><div class="ht-value usd">$${fmtCurrency(totalUsd)}</div></div>
    <div class="ht-item"><div class="ht-label">Chichas</div><div class="ht-value" style="color:var(--text);">${chichasUsd}</div></div>
    <div class="ht-item"><div class="ht-label">Bs Efec.</div><div class="ht-value ves">${bsEf > 0 ? fmtVes(bsEf) : '0'}</div></div>
    <div class="ht-item"><div class="ht-label">Bs P.Movil</div><div class="ht-value ves">${bsPM > 0 ? fmtVes(bsPM) : '0'}</div></div>
  `;

  if (ventas.length === 0 && dias.length === 0) {
    listEl.innerHTML = '<div class="empty-state">Este día no fue trabajado</div>';
    return;
  }

  function chichaInfo(d) {
    let s = '';
    if (d.chicha_ventas) s += ` 🥤${d.chicha_ventas}`;
    if (d.chicha_onzas) s += ` (${fmtCurrency(d.chicha_onzas)} oz)`;
    return s;
  }
  function usdEfInfo(d) {
    return d.usd_efectivo ? ` 💵$${fmtCurrency(d.usd_efectivo)} efec` : '';
  }

  if (ventas.length === 0 && dias.length > 0) {
    const d = dias[0];
    listEl.innerHTML = `<div class="empty-state">✅ Día cerrado — ${d.ventas_count} ventas${chichaInfo(d)}${usdEfInfo(d)}, $${fmtCurrency(d.total_usd)}${d.total_ves > 0 ? ' · ' + fmtVes(d.total_ves) : ''}</div>`;
    return;
  }

  function iconoPago(moneda, metodo) {
    if (moneda === 'USD') return 'USD';
    if (metodo === 'mixto') return 'Mixto';
    return metodo === 'pago_movil' ? 'Pago Movil' : 'Efectivo';
  }

  let html = '';
  ventas.forEach(v => {
    const vendedor = v.vendedor_nombre ? ' - ' + v.vendedor_nombre : '';
    const cliente = v.cliente_nombre ? ' - ' + v.cliente_nombre : '';
    const punto = v.lugar ? ' ' + v.lugar : '';
    const pagoLabel = iconoPago(v.moneda, v.metodo_pago);
    const monedaLabel = v.moneda === 'USD' ? 'USD' : 'Bs';
    const mixtoDetail = v.metodo_pago === 'mixto' && v.efectivo_bs
      ? ` <span style="font-size:0.7rem;color:var(--text-light)">(Ef ${fmtVes(v.efectivo_bs)} + PM ${fmtVes(v.pagomovil_bs)})</span>`
      : '';
    html += `<div class="history-item">
      <div class="hi-left">
        <div class="hi-time">${fmtDate(v.creado_en)} ${fmtTime(v.creado_en)}</div>
        <div class="hi-name">${v.producto_nombre}</div>
        <div class="hi-meta">${pagoLabel} ${monedaLabel}${mixtoDetail}${vendedor}${cliente}${punto}</div>
      </div>
      <div class="hi-right">
        <div class="hi-usd">$${fmtCurrency(v.precio_usd)}</div>
        <div class="hi-ves">${v.precio_ves > 0 ? fmtVes(v.precio_ves) : 'Bs 0'}</div>
      </div>
      <button class="hi-delete" onclick="window.eliminarVenta('${v.id}')">X</button>
    </div>`;
  });

  if (dias.length > 0) {
    const d = dias[0];
    html += `<div class="day-closed-badge">✅ Día cerrado — ${d.ventas_count} ventas${chichaInfo(d)}${usdEfInfo(d)} · $${fmtCurrency(d.total_usd)}${d.total_ves > 0 ? ' · ' + fmtVes(d.total_ves) : ''}</div>`;
  }

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
