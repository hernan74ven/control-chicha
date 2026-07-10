import { state } from './state.js';
import { api } from './api.js';
import { toast, todayStr, fmtCurrency, fmtVes, abrirModal, cerrarModal } from './ui.js';
import { trackVenta } from './analytics.js';

let chichaInicialOnzas = 0;
let chichaVendidoHoy = 0;  // contador local para evitar depender de consultas a Firestore
let diaCerradoHoy = false;
let _reopenTimer = null;
export let monedaSeleccionada = 'USD';
export let metodoPagoSeleccionado = 'efectivo';
let vendedorActivo = null;

// ---- MODO VARIAS ----
let modoVarias = false;

export function toggleModoVarias() {
  modoVarias = !modoVarias;
  const fab = document.getElementById('carritoFab');
  if (fab && !modoVarias) {
    fab.classList.add('hidden');
  }
  if (modoVarias) {
    renderCarrito();
  }
  renderVender();
}

export function isModoVarias() { return modoVarias; }

// ---- CARRITO ----
let carrito = [];

export function getCarrito() { return carrito; }

export function agregarAlCarrito(tipo, id, nombre, precioUsd) {
  if (!checkDiaActivo()) return;
  const existente = carrito.find(item => item.producto_id === id && item.tipo_producto === tipo);
  if (existente) {
    existente.cantidad++;
  } else {
    carrito.push({
      tipo_producto: tipo,
      producto_id: id,
      producto_nombre: nombre,
      precio_usd: precioUsd,
      cantidad: 1,
    });
  }
  renderCarrito();
  toast('+1 ' + nombre);
}

export function carritoSumar(index) {
  if (carrito[index]) {
    carrito[index].cantidad++;
    renderCarrito();
  }
}

export function carritoRestar(index) {
  if (carrito[index]) {
    carrito[index].cantidad--;
    if (carrito[index].cantidad <= 0) {
      carrito.splice(index, 1);
    }
    renderCarrito();
  }
}

export function carritoEliminar(index) {
  carrito.splice(index, 1);
  renderCarrito();
}

export function renderCarrito() {
  const el = document.getElementById('carritoItems');
  const totalEl = document.getElementById('carritoTotal');
  const fab = document.getElementById('carritoFab');
  const fabCount = document.getElementById('carritoFabCount');
  if (!el) return;

  if (fab && fabCount) {
    const total = carrito.reduce((s, item) => s + item.cantidad, 0);
    if (total > 0 && modoVarias) {
      fab.classList.remove('hidden');
      fabCount.textContent = total;
    } else {
      fab.classList.add('hidden');
    }
  }

  if (carrito.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-light);font-size:0.8rem;padding:12px 0;">Toca un producto para agregarlo</div>';
    totalEl.textContent = '';
    return;
  }

  let totalUsd = 0;
  let html = '';
  carrito.forEach((item, i) => {
    const subtotal = item.precio_usd * item.cantidad;
    totalUsd += subtotal;
    const v = calcVes(subtotal);
    html += `<div class="carrito-item">
      <div class="ci-info">
        <span class="ci-nombre">${item.producto_nombre}</span>
        <span class="ci-precio">$${fmtCurrency(item.precio_usd)} c/u</span>
      </div>
      <div class="ci-controls">
        <button class="btn btn-sm btn-outline ci-btn" onclick="window.carritoRestar(${i})">-</button>
        <span class="ci-cantidad">${item.cantidad}</span>
        <button class="btn btn-sm btn-outline ci-btn" onclick="window.carritoSumar(${i})">+</button>
        <span class="ci-subtotal">$${fmtCurrency(subtotal)}${v > 0 ? ' / ' + fmtVes(v) : ''}</span>
        <button class="ci-remove" onclick="window.carritoEliminar(${i})">X</button>
      </div>
    </div>`;
  });

  const totalVes = calcVes(totalUsd);
  el.innerHTML = html;
  totalEl.innerHTML = `<strong>Total: $${fmtCurrency(totalUsd)}</strong>${totalVes > 0 ? ` | <strong>${fmtVes(totalVes)}</strong>` : ''}`;
  totalEl.dataset.ves = totalVes;
}

// ---- CORE ----

function buscarTamano(productoId) {
  let tam = state.tamanos.find(t => String(t.id) === String(productoId));
  if (!tam && productoId) {
    tam = state.tamanos.find(t => t.orden === Number(productoId));
  }
  return tam;
}

export function getTasa() {
  return parseFloat(state.config.tasa_dolar) || 0;
}

export function calcVes(usd) {
  const t = getTasa();
  return t > 0 ? usd * t : 0;
}

export async function renderHeader() {
  const now = new Date();
  document.getElementById('headerDate').textContent =
    now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const t = getTasa();
  const punto = state.config.punto_actual || state.config.lugar_actual || '';
  document.getElementById('rateBadge').textContent = t > 0
    ? 'Bs ' + t.toFixed(2)
    : 'Configurar tasa';
  const sel = document.getElementById('puntoSelector');
  try {
    const puntos = await api('GET', '/puntos');
    state.puntos = puntos;
    const activo = state.config.punto_actual || state.config.lugar_actual || '';
    sel.innerHTML = puntos.length > 1
      ? `<select id="puntoSelect" onchange="window.cambiarPunto(this.value)">
          ${puntos.map(p => `<option value="${p.nombre}" ${p.nombre === activo ? 'selected' : ''}>${p.nombre}</option>`).join('')}
        </select>`
      : activo ? ` <strong style="color:var(--primary);font-size:0.75rem;">${activo}</strong>` : '';
  } catch (e) { sel.innerHTML = ''; }
}

export async function cambiarPunto(nombre) {
  if (!nombre || nombre === (state.config.punto_actual || '')) return;
  // Load per-punto config
  const prefijo = 'punto_' + nombre + '_';
  const config = await api('GET', '/config');
  const tasaPunto = parseFloat(config[prefijo + 'tasa_dolar']) || parseFloat(config.tasa_dolar) || 0;
  const onzasPunto = parseFloat(config[prefijo + 'chicha_inicial_onzas']) || 0;
  // Update config
  await api('PUT', '/config', { key: 'punto_actual', value: nombre });
  if (tasaPunto > 0) await api('PUT', '/config', { key: 'tasa_dolar', value: String(tasaPunto) });
  if (onzasPunto > 0) await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(onzasPunto) });
  state.config.punto_actual = nombre;
  state.config.tasa_dolar = String(tasaPunto);
  state.config.chicha_inicial_onzas = String(onzasPunto);
  await inicializarChichaVendido();
  window.renderAll();
  toast('Punto: ' + nombre);
}

export async function renderVender() {
  await renderHeader();
  const statsEl = document.getElementById('statsRow');
  const topEl = document.getElementById('venderTopBar');
  const prodEl = document.getElementById('productsContainer');

  cargarStatsHoy().then(stats => {
    const d = stats.desglose;
    const bsEf = d ? d.bs_efectivo.ves : 0;
    const bsPM = d ? d.bs_pago_movil.ves : 0;
    statsEl.innerHTML = `
      <div class="stat-card"><div class="sl">Hoy</div><div class="sv" style="color:var(--text);">${stats.count}</div></div>
      <div class="stat-card"><div class="sl">USD</div><div class="sv usd">$${fmtCurrency(stats.usd)}</div></div>
      <div class="stat-card"><div class="sl">Bs Efec.</div><div class="sv ves">${bsEf > 0 ? fmtVes(bsEf) : '0'}</div></div>
      <div class="stat-card"><div class="sl">Bs P.Movil</div><div class="sv ves">${bsPM > 0 ? fmtVes(bsPM) : '0'}</div></div>
    `;
  });

  renderChichaStatus();

  const selVendedor = `<label>Vendedor:</label><select id="vendedorSelect" onchange="window.guardarVendedorActivo()">
    ${state.vendedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('')}
  </select>`;
  topEl.innerHTML = selVendedor;

  const clickFn = modoVarias ? 'agregarAlCarrito' : 'iniciarVenta';
  const variasActive = modoVarias ? ' product-card-varias-active' : '';

  let html = '';
  if (state.tamanos.length > 0) {
    html += '<div class="section-head" style="margin-top:4px;"><h2>Chicha</h2></div><div class="product-grid">';
    state.tamanos.forEach(s => {
      const v = calcVes(s.precio_usd);
      html += `<div class="product-card chicha" onclick="window.${clickFn}('chicha', '${s.id}','${s.nombre.replace(/'/g, "\\'")}',${s.precio_usd})">
        <div class="pname">${s.nombre}</div>
        <div class="pprice">
          <span class="usd">$${fmtCurrency(s.precio_usd)}</span>${v > 0 ? ' | <span class="ves">' + fmtVes(v) + '</span>' : ''}
        </div>
      </div>`;
    });
    html += `<div class="product-card product-card-varias${variasActive}" onclick="window.toggleModoVarias()">
      <div class="pname">Varias</div>
      <div class="pprice"><span class="usd">${modoVarias ? 'ON' : 'OFF'}</span></div>
    </div>`;
    html += '</div>';
  }
  if (state.otrosProductos.length > 0) {
    html += '<div class="section-head" style="margin-top:16px;"><h2>Otros</h2></div><div class="product-grid">';
    state.otrosProductos.forEach(p => {
      const v = calcVes(p.precio_usd);
      html += `<div class="product-card other" onclick="window.${clickFn}('other', '${p.id}','${p.nombre.replace(/'/g, "\\'")}',${p.precio_usd})">
        <div class="pname">${p.nombre}</div>
        <div class="pprice">
          <span class="usd">$${fmtCurrency(p.precio_usd)}</span>${v > 0 ? ' | <span class="ves">' + fmtVes(v) + '</span>' : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  }
  if (state.tamanos.length === 0 && state.otrosProductos.length === 0) {
    html = '<div class="empty-state">No hay productos configurados.<br>Ve a Config para agregarlos.</div>';
  }
  prodEl.innerHTML = html;
}

export function extraerDesglose(pagoDesglose) {
  const d = { usd_efectivo: { cant: 0, usd: 0, ves: 0 }, bs_efectivo: { cant: 0, usd: 0, ves: 0 }, bs_pago_movil: { cant: 0, usd: 0, ves: 0 } };
  (pagoDesglose || []).forEach(p => {
    if (p.moneda === 'USD') {
      d.usd_efectivo.cant += p.cantidad;
      d.usd_efectivo.usd += p.total_usd;
      d.usd_efectivo.ves += p.total_ves;
    } else if (p.metodo_pago === 'efectivo') {
      d.bs_efectivo.cant += p.cantidad;
      d.bs_efectivo.usd += p.total_usd;
      d.bs_efectivo.ves += p.total_ves;
    } else if (p.metodo_pago === 'mixto') {
      const ef = p.efectivo_bs || 0;
      const pm = p.pagomovil_bs || 0;
      d.bs_efectivo.cant += p.cantidad;
      d.bs_efectivo.usd += p.total_usd * (ef / (ef + pm || 1));
      d.bs_efectivo.ves += ef;
      d.bs_pago_movil.cant += p.cantidad;
      d.bs_pago_movil.usd += p.total_usd * (pm / (ef + pm || 1));
      d.bs_pago_movil.ves += pm;
    } else {
      d.bs_pago_movil.cant += p.cantidad;
      d.bs_pago_movil.usd += p.total_usd;
      d.bs_pago_movil.ves += p.total_ves;
    }
  });
  return d;
}

async function cargarStatsHoy() {
  try {
    const r = await api('GET', '/reportes/resumen?desde=' + todayStr() + '&hasta=' + todayStr());
    const d = extraerDesglose(r.pagoDesglose);
    return { count: r.totales.total_ventas, usd: r.totales.total_usd, ves: r.totales.total_ves, desglose: d };
  } catch (e) {
    return { count: 0, usd: 0, ves: 0, desglose: null };
  }
}

export async function renderChichaStatus() {
  const el = document.getElementById('chichaStatus');
  try {
    const config = await api('GET', '/config');
    chichaInicialOnzas = parseFloat(config.chicha_inicial_onzas) || 0;
    state.config = config;
  } catch (e) { chichaInicialOnzas = 0; }

  const restante = Math.max(0, chichaInicialOnzas - chichaVendidoHoy);
  const pct = chichaInicialOnzas > 0 ? (restante / chichaInicialOnzas * 100) : 0;
  let fillClass = '';
  if (pct <= 15) fillClass = 'critical';
  else if (pct <= 30) fillClass = 'low';

  if (chichaInicialOnzas <= 0) {
    el.innerHTML = diaCerradoHoy
      ? `<div class="cs-header">
          <span class="cs-label">Chicha en envase</span>
          <span style="font-size:0.72rem;color:var(--text-light);">Dia cerrado</span>
        </div>`
      : `<div class="cs-header">
          <span class="cs-label">Chicha en envase</span>
          <span style="font-size:0.72rem;color:var(--text-light);">Dia no iniciado</span>
        </div>`;
    return;
  }

  const puntoActual = state.config.punto_actual || state.config.lugar_actual || '';
  el.innerHTML = `
    <div class="cs-header">
      <span class="cs-label">Chicha en envase${puntoActual ? ' ' + puntoActual : ''}</span>
      <span class="cs-info">${fmtCurrency(restante)} oz / ${fmtCurrency(chichaInicialOnzas)} oz</span>
    </div>
    <div class="cs-bar">
      <div class="cs-fill ${fillClass}" style="width:${pct}%"></div>
      <div class="cs-abs">${pct.toFixed(0)}%</div>
    </div>
    </div>
    ${restante <= 0 ? '<div style="color:var(--danger);font-size:0.75rem;font-weight:600;margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">Chicha agotada <button class="btn btn-sm btn-outline" onclick="window.abrirModal(\'modalChichaAgotada\')">Que hacer?</button></div>' : ''}
  `;
}

export async function mostrarInicioDia() {
  try {
    const [config, puntos] = await Promise.all([
      api('GET', '/config'),
      api('GET', '/puntos'),
    ]);
    state.config = config;
    state.puntos = puntos;
    const sel = document.getElementById('inicioPunto');
    const actual = state.config.punto_actual || state.config.lugar_actual || '';
    sel.innerHTML = '<option value="">Seleccionar punto...</option>' +
      puntos.map(p => `<option value="${p.nombre}" ${p.nombre === actual ? 'selected' : ''}>${p.nombre}</option>`).join('');
  } catch (e) { /* ignore */ }
  document.getElementById('inicioTasa').value = state.config.tasa_dolar || '';
  document.getElementById('inicioOnzas').value = state.config.receta_total_onzas || '720';
  abrirModal('modalInicioDia');
}

export async function comenzarDia() {
  const tasa = parseFloat(document.getElementById('inicioTasa').value);
  const onzas = parseFloat(document.getElementById('inicioOnzas').value);
  const punto = document.getElementById('inicioPunto').value.trim();
  if (!tasa || tasa <= 0) { toast('Ingresa la tasa del dolar'); return; }
  if (!onzas || onzas <= 0) { toast('Ingresa las onzas iniciales'); return; }
  try {
    await api('PUT', '/config', { key: 'tasa_dolar', value: String(tasa) });
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(onzas) });
    await api('PUT', '/config', { key: 'punto_actual', value: punto });
    // Save per-punto config
    if (punto) {
      const prefijo = 'punto_' + punto + '_';
      await api('PUT', '/config', { key: prefijo + 'tasa_dolar', value: String(tasa) });
      await api('PUT', '/config', { key: prefijo + 'chicha_inicial_onzas', value: String(onzas) });
    }
    chichaVendidoHoy = 0;
    diaCerradoHoy = false;
    if (punto) {
      const config = await api('GET', '/config');
      const puntos = config.puntos_usados ? JSON.parse(config.puntos_usados) : config.lugares_usados ? JSON.parse(config.lugares_usados) : [];
      if (!puntos.includes(punto)) {
        puntos.push(punto);
        await api('PUT', '/config', { key: 'puntos_usados', value: JSON.stringify(puntos) });
      }
    }
    toast('Dia iniciado: ' + onzas + ' oz - Tasa: Bs ' + tasa.toFixed(2) + (punto ? ' - ' + punto : ''));
    cerrarModal('modalInicioDia');
state.config.tasa_dolar = String(tasa);
    state.config.punto_actual = lugar;
    window.renderAll();
  } catch (e) { toast('Error: ' + e.message); }
}

export async function cerrarDia() {
  if (!confirm('¿Estás seguro de cerrar el día? Esta acción no se puede deshacer.')) return;
  if (!confirm('⚠️ CONFIRMACIÓN FINAL: ¿Cerrar el día ahora? Se reseteará la chicha y empezarás un nuevo día.')) return;
  try {
    const hoy = todayStr();
    const punto = getPuntoActual();
    const ventasHoy = await api('GET', `/ventas?desde=${hoy}&hasta=${hoy}`);
    const ventasPunto = punto ? ventasHoy.filter(v => v.lugar === punto) : ventasHoy;
    const total_usd = ventasPunto.reduce((s, v) => s + v.precio_usd, 0);
    const total_ves = ventasPunto.reduce((s, v) => s + v.precio_ves, 0);
    const usd_efectivo = ventasPunto.filter(v => v.moneda === 'USD' && v.metodo_pago === 'efectivo').reduce((s, v) => s + v.precio_usd, 0);
    let chicha_onzas = 0, chicha_ventas = 0;
    ventasPunto.forEach(v => {
      if (v.tipo_producto === 'chicha') {
        chicha_ventas++;
        const tam = buscarTamano(v.producto_id);
        chicha_onzas += tam ? (tam.onzaxvaso || 0) : 0;
      }
    });
    await api('POST', '/dias/cerrar', {
      fecha: hoy,
      punto: punto,
      ventas_count: ventasPunto.length,
      total_usd,
      total_ves,
      usd_efectivo,
      chicha_onzas,
      chicha_ventas
    });
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: '0' });
    if (punto) await api('PUT', '/config', { key: 'punto_' + punto + '_chicha_inicial_onzas', value: '0' });
    chichaVendidoHoy = 0;
    diaCerradoHoy = true;
    toast('Dia cerrado');
    cerrarModal('modalChichaAgotada');
    window.renderAll();
  } catch (e) { toast('Error'); }
}

// ---- Long-press reabrir día ----
export function _iniciarReapertura() {
  if (_reopenTimer) return;
  _reopenTimer = setTimeout(() => {
    _reopenTimer = null;
    reabrirDia();
  }, 6000);
}
export function _cancelarReapertura() {
  if (_reopenTimer) { clearTimeout(_reopenTimer); _reopenTimer = null; }
}

async function reabrirDia() {
  const hoy = todayStr();
  const punto = getPuntoActual();
  let info = '';
  let docId = hoy + (punto ? '_' + punto : '');
  try {
    const dias = await api('GET', `/dias?desde=${hoy}&hasta=${hoy}`);
    const d = dias.find(x => x.id === docId || (!punto && x.fecha === hoy));
    if (d) {
      let ch = '';
      if (d.chicha_ventas) ch += ` 🥤${d.chicha_ventas}`;
      if (d.chicha_onzas) ch += ` (${fmtCurrency(d.chicha_onzas)} oz)`;
      const ef = d.usd_efectivo ? ` 💵$${fmtCurrency(d.usd_efectivo)} efec` : '';
      info = ` (${d.ventas_count} ventas${ch}${ef}, $${fmtCurrency(d.total_usd)}${d.total_ves > 0 ? ', ' + fmtVes(d.total_ves) : ''})`;
    }
  } catch (_) {}
  if (!confirm(`⚠️ REABRIR DÍA DE EMERGENCIA\n\nEste día ya fue cerrado${info}. ¿Estás seguro de querer reabrirlo?`)) return;
  if (!confirm('⚠️ CONFIRMACIÓN FINAL: ¿Reabrir el día? Se borrará el registro de cierre y podrás vender nuevamente.')) return;
  try {
    await api('DELETE', '/dias/' + docId);
    diaCerradoHoy = false;
    toast('Día reabierto — inicia el día para vender');
    mostrarInicioDia();
  } catch (e) { toast('Error al reabrir'); }
}

export function guardarVendedorActivo() {
  const sel = document.getElementById('vendedorSelect');
  vendedorActivo = sel ? sel.value : null;
}

export function getVendedorActivo() {
  if (vendedorActivo === null || vendedorActivo === undefined || Number.isNaN(Number(vendedorActivo))) {
    const sel = document.getElementById('vendedorSelect');
    if (sel) vendedorActivo = sel.value;
  }
  return vendedorActivo;
}

// ---- VENTA UNITARIA ----

export function seleccionarMoneda(mon) {
  monedaSeleccionada = mon;

  // Update both unit and carrito modals
  document.querySelectorAll('#modalMoneda .mp-opt, #modalMonedaCarrito .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === mon);
  });

  const optPMUnidad = document.getElementById('optPagoMovilUnidad');
  const optPMCarrito = document.getElementById('optPagoMovilCarrito');
  const optMixtoUnidad = document.getElementById('optMixtoUnidad');
  const optMixtoCarrito = document.getElementById('optMixtoCarrito');

  if (mon === 'USD') {
    metodoPagoSeleccionado = 'efectivo';
    [optPMUnidad, optPMCarrito, optMixtoUnidad, optMixtoCarrito].forEach(el => {
      if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('#modalMetodoPago .mp-opt, #modalMetodoPagoCarrito .mp-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.val === 'efectivo');
    });
  } else {
    [optPMUnidad, optPMCarrito, optMixtoUnidad, optMixtoCarrito].forEach(el => {
      if (el) el.classList.remove('hidden');
    });
  }
  document.getElementById('mixtoInputsUnidad')?.classList.add('hidden');
  document.getElementById('mixtoInputsCarrito')?.classList.add('hidden');
}

export function seleccionarMetodoPago(mp) {
  metodoPagoSeleccionado = mp;
  document.querySelectorAll('#modalMetodoPago .mp-opt, #modalMetodoPagoCarrito .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === mp);
  });
  const show = mp === 'mixto';
  document.getElementById('mixtoInputsUnidad')?.classList.toggle('hidden', !show);
  document.getElementById('mixtoInputsCarrito')?.classList.toggle('hidden', !show);
  if (show && monedaSeleccionada === 'VES') {
    actualizarMixtoPagoMovil('unidad');
    actualizarMixtoPagoMovil('carrito');
  }
}

export function actualizarMixtoPagoMovil(tipo) {
  const totalVes = tipo === 'unidad'
    ? parseFloat(document.getElementById('modalProductoPrecio')?.dataset?.ves || '0')
    : parseFloat(document.getElementById('carritoTotal')?.dataset?.ves || '0');
  const ef = parseFloat(document.getElementById('mixtoEfectivo' + (tipo === 'unidad' ? 'Unidad' : 'Carrito'))?.value) || 0;
  const pm = Math.max(0, totalVes - ef);
  const span = document.getElementById('mixtoPagoMovil' + (tipo === 'unidad' ? 'Unidad' : 'Carrito'));
  if (span) span.textContent = pm.toFixed(2).replace('.', ',');
}

export function iniciarVenta(tipo, id, nombre, precioUsd) {
  if (!checkDiaActivo()) return;
  state.ventaPendiente = { tipo_producto: tipo, producto_id: id, producto_nombre: nombre, precio_usd: precioUsd };
  monedaSeleccionada = 'USD';
  metodoPagoSeleccionado = 'efectivo';
  document.querySelectorAll('#modalVentaUnidad .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === 'USD');
  });
  document.querySelectorAll('#modalVentaUnidad .mp-opt.pago-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === 'efectivo');
  });
  document.getElementById('optPagoMovilUnidad').classList.add('hidden');
  document.getElementById('optMixtoUnidad').classList.add('hidden');
  document.getElementById('mixtoInputsUnidad')?.classList.add('hidden');
  document.getElementById('mixtoInputsCarrito')?.classList.add('hidden');
  document.getElementById('modalProductoName').textContent = nombre;
  const v = calcVes(precioUsd);
  const precioEl = document.getElementById('modalProductoPrecio');
  precioEl.innerHTML =
    `<strong>$${fmtCurrency(precioUsd)}</strong>${v > 0 ? ` | <strong>${fmtVes(v)}</strong>` : ''}`;
  precioEl.dataset.ves = v;
  const sel = document.getElementById('modalClienteUnidad');
  sel.innerHTML = '<option value="">Sin cliente</option>';
  api('GET', '/clientes').then(clientes => {
    clientes.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
  }).catch(() => {});
  abrirModal('modalVentaUnidad');
}

export async function confirmarVentaUnidad() {
  if (!state.ventaPendiente) return;
  const body = { ...state.ventaPendiente };
  body.moneda = monedaSeleccionada;
  body.metodo_pago = metodoPagoSeleccionado;
  body.vendedor_id = getVendedorActivo();
  body.lugar = state.config.punto_actual || state.config.lugar_actual || '';
  const cid = document.getElementById('modalClienteUnidad').value;
  if (cid) body.cliente_id = cid;
  if (body.metodo_pago === 'mixto' && body.moneda === 'VES') {
    const totalVes = calcVes(body.precio_usd);
    const ef = parseFloat(document.getElementById('mixtoEfectivoUnidad')?.value) || 0;
    body.efectivo_bs = Math.min(ef, totalVes);
    body.pagomovil_bs = Math.max(0, totalVes - body.efectivo_bs);
  }
  try {
    const venta = await api('POST', '/ventas', body);
    toast(venta.producto_nombre + ' vendido!');
    trackVenta(venta);
    state.ventaPendiente = null;
    cerrarModal('modalVentaUnidad');
    if (body.tipo_producto === 'chicha') {
      const tam = buscarTamano(body.producto_id);
      chichaVendidoHoy += tam ? (tam.onzaxvaso || 0) : 0;
    }
    renderVender();
    if (body.tipo_producto === 'chicha') {
      checkChichaAgotada();
    }
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

// ---- CARRITO - VENTA VARIAS ----

export function abrirCarrito() {
  monedaSeleccionada = 'USD';
  metodoPagoSeleccionado = 'efectivo';
  document.querySelectorAll('#modalVentaCarrito .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === 'USD');
  });
  document.querySelectorAll('#modalVentaCarrito .mp-opt.pago-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === 'efectivo');
  });
  document.getElementById('optPagoMovilCarrito').classList.add('hidden');
  document.getElementById('optMixtoCarrito').classList.add('hidden');
  document.getElementById('mixtoInputsUnidad')?.classList.add('hidden');
  document.getElementById('mixtoInputsCarrito')?.classList.add('hidden');
  const sel = document.getElementById('modalClienteCarrito');
  sel.innerHTML = '<option value="">Sin cliente</option>';
  api('GET', '/clientes').then(clientes => {
    clientes.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
  }).catch(() => {});
  renderCarrito();
  abrirModal('modalVentaCarrito');
}

export async function confirmarVentaCarrito() {
  if (carrito.length === 0) { toast('Agrega al menos un producto'); return; }
  const clienteId = document.getElementById('modalClienteCarrito').value;
  const totalUsdCarrito = carrito.reduce((s, item) => s + item.precio_usd * item.cantidad, 0);
  const body = {
    items: carrito.map(item => ({
      tipo_producto: item.tipo_producto,
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre,
      precio_usd: item.precio_usd,
      cantidad: item.cantidad,
    })),
    moneda: monedaSeleccionada,
    metodo_pago: metodoPagoSeleccionado,
    vendedor_id: getVendedorActivo(),
    lugar: state.config.punto_actual || state.config.lugar_actual || '',
    cliente_id: clienteId || null,
  };
  if (body.metodo_pago === 'mixto' && body.moneda === 'VES') {
    const totalVes = totalUsdCarrito * parseFloat(state.config.tasa_dolar || '0');
    const ef = parseFloat(document.getElementById('mixtoEfectivoCarrito')?.value) || 0;
    body.efectivo_bs = Math.min(ef, totalVes);
    body.pagomovil_bs = Math.max(0, totalVes - body.efectivo_bs);
  }
  try {
    await api('POST', '/ventas', body);
    const totalUsd = carrito.reduce((s, item) => s + item.precio_usd * item.cantidad, 0);
    carrito.forEach(item => {
      if (item.tipo_producto === 'chicha') {
        const tam = buscarTamano(item.producto_id);
        const onzasItem = tam ? (tam.onzaxvaso || 0) : 0;
        chichaVendidoHoy += onzasItem * item.cantidad;
      }
    });
    toast(`${carrito.length} producto(s) vendido(s) - $${fmtCurrency(totalUsd)}`);
    trackVenta({ tipo_producto: 'carrito', precio_usd: totalUsd, moneda: monedaSeleccionada, metodo_pago: metodoPagoSeleccionado, vendedor_nombre: '' });
    carrito = [];
    cerrarModal('modalVentaCarrito');
    renderVender();
    checkChichaAgotada();
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

async function checkChichaAgotada() {
  if (chichaInicialOnzas - chichaVendidoHoy <= 0) {
    setTimeout(() => abrirModal('modalChichaAgotada'), 500);
  }
}

function checkDiaActivo() {
  if (chichaInicialOnzas > 0) return true;
  const msg = diaCerradoHoy ? 'Ya cerró el día' : 'No ha iniciado el día';
  toast(msg);
  return false;
}

function getPuntoActual() {
  return state.config.punto_actual || state.config.lugar_actual || '';
}

export async function inicializarChichaVendido() {
  try {
    const hoy = todayStr();
    const punto = getPuntoActual();
    let urlVentas = `/ventas?desde=${hoy}&hasta=${hoy}`;
    let urlDias = `/dias?desde=${hoy}&hasta=${hoy}`;
    const [ventasHoy, dias] = await Promise.all([
      api('GET', urlVentas),
      api('GET', urlDias)
    ]);
    diaCerradoHoy = dias.length > 0 && dias[0].estado === 'cerrado';
    chichaVendidoHoy = 0;
    ventasHoy.forEach(v => {
      if (v.tipo_producto === 'chicha' && (!punto || v.lugar === punto)) {
        const tam = buscarTamano(v.producto_id);
        chichaVendidoHoy += tam ? (tam.onzaxvaso || 0) : 0;
      }
    });
  } catch (e) { chichaVendidoHoy = 0; }
}

export async function sincronizarChichaVendido() {
  const antes = chichaVendidoHoy;
  await inicializarChichaVendido();
  if (chichaVendidoHoy !== antes) {
    renderChichaStatus();
  }
}

export async function iniciarLoteChicha() {
  const val = parseFloat(document.getElementById('chichaInitInput').value);
  if (!val || val <= 0) { toast('Ingresa una cantidad valida'); return; }
  try {
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(val) });
    toast('Lote iniciado: ' + val + ' oz');
    renderVender();
  } catch (e) { toast('Error'); }
}

export async function reabastecerChicha() {
  const input = document.getElementById('chichaNuevoTotal');
  const extra = parseFloat(input?.value);
  if (!extra || extra <= 0) { toast('Ingresa cuantas onzas vas a agregar'); input?.focus(); return; }
  const nuevoTotal = chichaInicialOnzas + extra;
  try {
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(nuevoTotal) });
    toast('Reabastecido: +' + extra + ' oz');
    input.value = '';
    document.getElementById('chichaResetDiv')?.classList.add('hidden');
    cerrarModal('modalChichaAgotada');
    renderVender();
  } catch (e) { toast('Error'); }
}
