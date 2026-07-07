import { api } from './api.js';
import { toast, todayStr, fmtCurrency, fmtVes, fmtDateShort } from './ui.js';
import { extraerDesglose } from './ventas.js';

export async function cargarReportes() {
  const rango = document.getElementById('reporteRango').value;
  let desde, hasta;
  const hoy = new Date();
  const hoyStr = todayStr();

  if (rango === 'hoy') { desde = hoyStr; hasta = hoyStr; }
  else if (rango === 'semana') {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    desde = inicio.toISOString().slice(0, 10);
    hasta = hoyStr;
  } else if (rango === 'mes') {
    desde = hoyStr.slice(0, 7) + '-01';
    hasta = hoyStr;
  } else {
    desde = '2000-01-01';
    hasta = '2099-12-31';
  }

  try {
    const data = await api('GET', `/reportes/resumen?desde=${desde}&hasta=${hasta}`);
    renderReportes(data);
  } catch (e) {
    toast('Error al cargar reportes');
  }
}

function renderReportes(data) {
  const el = document.getElementById('reportesContent');
  const t = data.totales;
  const d = extraerDesglose(data.pagoDesglose);

  el.innerHTML = `
    <div class="report-cards">
      <div class="report-card"><div class="rc-label">Ventas</div><div class="rc-value" style="color:var(--text);">${t.total_ventas}</div></div>
      <div class="report-card"><div class="rc-label">USD</div><div class="rc-value usd">$${fmtCurrency(t.total_usd)}</div></div>
      <div class="report-card"><div class="rc-label">Bs Efectivo</div><div class="rc-value ves">${d.bs_efectivo.ves > 0 ? fmtVes(d.bs_efectivo.ves) : '0'}</div></div>
      <div class="report-card"><div class="rc-label">Bs P.Movil</div><div class="rc-value ves">${d.bs_pago_movil.ves > 0 ? fmtVes(d.bs_pago_movil.ves) : '0'}</div></div>
    </div>
    ${renderDesglosePagos(data.pagoDesglose)}
    ${renderMasVendido(data.masVendido)}
    ${renderPorVendedor(data.porVendedor)}
    ${renderPorDia(data.ventasPorDia)}
  `;
}

function renderDesglosePagos(pagoDesglose) {
  if (!pagoDesglose || pagoDesglose.length === 0) return '';
  const icono = (m, mp) => {
    if (m === 'USD') return 'USD';
    return mp === 'pago_movil' ? 'Bs Pago Movil' : 'Bs Efectivo';
  };
  let rows = pagoDesglose.map(p =>
    `<div class="rt-row">
      <span class="rt-name">${icono(p.moneda, p.metodo_pago)}</span>
      <span class="rt-val">${p.cantidad} ventas - $${fmtCurrency(p.total_usd)} - ${p.total_ves > 0 ? fmtVes(p.total_ves) : 'Bs 0'}</span>
    </div>`
  ).join('');
  return `<div class="report-section"><h3>Desglose de pagos</h3><div class="report-table">${rows}</div></div>`;
}

function renderMasVendido(items) {
  if (!items || items.length === 0) return '';
  let rows = items.map(i =>
    `<div class="rt-row"><span class="rt-name">${i.producto_nombre}</span><span class="rt-val">${i.cantidad} ventas - $${fmtCurrency(i.total)}</span></div>`
  ).join('');
  return `<div class="report-section"><h3>Mas vendido</h3><div class="report-table">${rows}</div></div>`;
}

function renderPorVendedor(items) {
  if (!items || items.length === 0) return '';
  let rows = items.map(i =>
    `<div class="rt-row"><span class="rt-name">${i.nombre || 'Sin vendedor'}</span><span class="rt-val">${i.cantidad} - $${fmtCurrency(i.total)}</span></div>`
  ).join('');
  return `<div class="report-section"><h3>Por vendedor</h3><div class="report-table">${rows}</div></div>`;
}

function renderPorDia(items) {
  if (!items || items.length === 0) return '';
  let rows = items.map(i =>
    `<div class="rt-row"><span class="rt-name">${fmtDateShort(i.dia)}</span><span class="rt-val">${i.cantidad} ventas - $${fmtCurrency(i.total)}</span></div>`
  ).join('');
  return `<div class="report-section"><h3>Por dia</h3><div class="report-table">${rows}</div></div>`;
}
