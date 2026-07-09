import { api } from './api.js';
import { toast, todayStr, fmtCurrency, fmtVes, fmtDateShort } from './ui.js';
import { extraerDesglose } from './ventas.js';
import { state } from './state.js';

export async function cargarReportes() {
  const rango = document.getElementById('reporteRango').value;
  const punto = document.getElementById('reportePunto')?.value || '';
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
    if (punto && data.totales) {
      const ventas = await api('GET', `/ventas?desde=${desde}&hasta=${hasta}`);
      const ventasPunto = ventas.filter(v => v.lugar === punto);
      const totales = ventasPunto.reduce((acc, v) => {
        acc.total_ventas++;
        acc.total_usd += v.precio_usd || 0;
        acc.total_ves += v.precio_ves || 0;
        return acc;
      }, { total_ventas: 0, total_usd: 0, total_ves: 0 });
      const prodMap = {}; ventasPunto.forEach(v => { prodMap[v.producto_nombre] = (prodMap[v.producto_nombre] || 0) + 1; });
      const masVendido = Object.entries(prodMap).map(([k, c]) => ({ producto_nombre: k, cantidad: c })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
      const pagoDesglose = [];
      const pgMap = {}; ventasPunto.forEach(v => { const k = v.moneda + '-' + v.metodo_pago; if (!pgMap[k]) pgMap[k] = { moneda: v.moneda, metodo_pago: v.metodo_pago, cantidad: 0, total_usd: 0, total_ves: 0 }; pgMap[k].cantidad++; pgMap[k].total_usd += v.precio_usd || 0; pgMap[k].total_ves += v.precio_ves || 0; });
      Object.values(pgMap).forEach(p => pagoDesglose.push(p));
      renderReportes({ totales, masVendido, porVendedor: [], ventasPorDia: [], pagoDesglose });
      return;
    }
    renderReportes(data);
  } catch (e) {
    toast('Error al cargar reportes');
  }
}

function renderReportes(data) {
  const el = document.getElementById('reportesContent');
  const t = data.totales;
  const d = extraerDesglose(data.pagoDesglose);
  const selP = document.getElementById('reportePunto');
  if (selP && selP.options.length <= 1) {
    selP.innerHTML = '<option value="">Todos los puntos</option>' +
      (state.puntos || []).map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');
  }

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
