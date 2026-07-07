// ===================== STATE =====================
let state = {
  config: { tasa_dolar: '0', moneda_local: 'Bs' },
  tamanos: [],
  otrosProductos: [],
  vendedores: [],
  ventaPendiente: null,
  clienteEditId: null,
  inventarioEditId: null,
  clienteActualId: null,
};

// ===================== API =====================
const API = '/api';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error del servidor');
  return json.data;
}

// ===================== TOAST =====================
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

// ===================== UTILS =====================
function todayStr() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function fmtCurrency(n) { return n.toFixed(2); }

function fmtVes(n) { return 'Bs ' + Math.round(n).toLocaleString(); }

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function fmtTime(iso) {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

function fmtDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' });
}

function getTasa() {
  return parseFloat(state.config.tasa_dolar) || 0;
}

function calcVes(usd) {
  const t = getTasa();
  return t > 0 ? usd * t : 0;
}

// ===================== INIT =====================
async function init() {
  try {
    const [config, tamanos, otrosProductos, vendedores] = await Promise.all([
      api('GET', '/config'),
      api('GET', '/tamanos'),
      api('GET', '/otros-productos'),
      api('GET', '/vendedores'),
    ]);
    state.config = config;
    state.tamanos = tamanos;
    state.otrosProductos = otrosProductos;
    state.vendedores = vendedores;
  } catch (e) {
    console.error('Error al cargar datos:', e);
    toast('Error al conectar con el servidor');
  }
  renderAll();
  // Show start day modal if no chicha active
  setTimeout(() => {
    const inicial = parseFloat(state.config.chicha_inicial_onzas) || 0;
    if (inicial <= 0) {
      mostrarInicioDia();
    }
  }, 500);
}

// ===================== TABS =====================
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');

  switch(tab) {
    case 'vender': renderVender(); break;
    case 'historial': cargarHistorial(); break;
    case 'reportes': cargarReportes(); break;
    case 'inventario':
      // default to items sub-tab
      document.querySelectorAll('#tabInventario .sub-tab').forEach(el => el.classList.remove('active'));
      document.querySelector('#tabInventario .sub-tab[data-subtab="items"]').classList.add('active');
      document.querySelectorAll('#tabInventario .subtab-content').forEach(el => el.classList.remove('active'));
      document.getElementById('subtabItems').classList.add('active');
      cargarInventario();
      break;
    case 'clientes': cargarClientes(); break;
    case 'config': renderConfig(); break;
  }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ===================== RENDER HEADER =====================
function renderHeader() {
  const now = new Date();
  document.getElementById('headerDate').textContent =
    now.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const t = getTasa();
  const lug = state.config.lugar_actual || '';
  document.getElementById('rateBadge').textContent = t > 0
    ? '💵 Bs ' + t.toFixed(2) + (lug ? ' 📍' + lug : '')
    : '⚙️ Configurar tasa';
}

// ===================== RENDER VENDER =====================
function renderVender() {
  renderHeader();
  const statsEl = document.getElementById('statsRow');
  const topEl = document.getElementById('venderTopBar');
  const prodEl = document.getElementById('productsContainer');

  // Stats
  cargarStatsHoy().then(stats => {
    const d = stats.desglose;
    const bsEf = d ? d.bs_efectivo.ves : 0;
    const bsPM = d ? d.bs_pago_movil.ves : 0;
    statsEl.innerHTML = `
      <div class="stat-card"><div class="sl">Hoy</div><div class="sv" style="color:var(--text);">${stats.count}</div></div>
      <div class="stat-card"><div class="sl">💵 USD</div><div class="sv usd">$${fmtCurrency(stats.usd)}</div></div>
      <div class="stat-card"><div class="sl">💵 Bs Efec.</div><div class="sv ves">${bsEf > 0 ? fmtVes(bsEf) : '0'}</div></div>
      <div class="stat-card"><div class="sl">📱 Bs P.Móvil</div><div class="sv ves">${bsPM > 0 ? fmtVes(bsPM) : '0'}</div></div>
    `;
  });

  // Chicha level
  renderChichaStatus();

  // Seller selector
  const selVendedor = `<label>👤 Vendedor:</label><select id="vendedorSelect" onchange="guardarVendedorActivo()">
    ${state.vendedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('')}
  </select>`;
  topEl.innerHTML = selVendedor;

  // Products
  let html = '';
  if (state.tamanos.length > 0) {
    html += '<div class="section-head" style="margin-top:4px;"><h2>🥤 Chicha</h2></div><div class="product-grid">';
    state.tamanos.forEach(s => {
      const v = calcVes(s.precio_usd);
      html += `<div class="product-card chicha" onclick="iniciarVenta('chicha',${s.id},'${s.nombre}',${s.precio_usd})">
        <div class="pname">${s.nombre}</div>
        <div class="pprice">
          <span class="usd">$${fmtCurrency(s.precio_usd)}</span>${v > 0 ? ' | <span class="ves">'+fmtVes(v)+'</span>' : ''}
        </div>
      </div>`;
    });
    html += '</div>';
  }
  if (state.otrosProductos.length > 0) {
    html += '<div class="section-head" style="margin-top:16px;"><h2>🍽️ Otros</h2></div><div class="product-grid">';
    state.otrosProductos.forEach(p => {
      const v = calcVes(p.precio_usd);
      html += `<div class="product-card other" onclick="iniciarVenta('other',${p.id},'${p.nombre}',${p.precio_usd})">
        <div class="pname">${p.nombre}</div>
        <div class="pprice">
          <span class="usd">$${fmtCurrency(p.precio_usd)}</span>${v > 0 ? ' | <span class="ves">'+fmtVes(v)+'</span>' : ''}
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

function extraerDesglose(pagoDesglose) {
  const d = { usd_efectivo: { cant:0, usd:0, ves:0 }, bs_efectivo: { cant:0, usd:0, ves:0 }, bs_pago_movil: { cant:0, usd:0, ves:0 } };
  (pagoDesglose || []).forEach(p => {
    if (p.moneda === 'USD') {
      d.usd_efectivo.cant += p.cantidad;
      d.usd_efectivo.usd += p.total_usd;
      d.usd_efectivo.ves += p.total_ves;
    } else if (p.metodo_pago === 'efectivo') {
      d.bs_efectivo.cant += p.cantidad;
      d.bs_efectivo.usd += p.total_usd;
      d.bs_efectivo.ves += p.total_ves;
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
    return {
      count: r.totales.total_ventas,
      usd: r.totales.total_usd,
      ves: r.totales.total_ves,
      desglose: d
    };
  } catch(e) {
    return { count: 0, usd: 0, ves: 0, desglose: null };
  }
}

// ===================== CHICHA LEVEL =====================
let chichaInicialOnzas = 0;

async function renderChichaStatus() {
  const el = document.getElementById('chichaStatus');

  // Get initial amount from config
  try {
    const config = await api('GET', '/config');
    chichaInicialOnzas = parseFloat(config.chicha_inicial_onzas) || 0;
    state.config = config;
  } catch(e) { chichaInicialOnzas = 0; }

  // Calculate sold onzas today
  const hoy = todayStr();
  let vendidoHoy = 0;
  try {
    const ventasHoy = await api('GET', `/ventas?desde=${hoy}&hasta=${hoy}`);
    // Only chicha sales
    ventasHoy.forEach(v => {
      if (v.tipo_producto === 'chicha') {
        const tam = state.tamanos.find(t => t.id === v.producto_id);
        const onzas = tam ? (tam.onzaxvaso || 0) : 0;
        vendidoHoy += onzas;
      }
    });
  } catch(e) {}

  const restante = Math.max(0, chichaInicialOnzas - vendidoHoy);
  const pct = chichaInicialOnzas > 0 ? (restante / chichaInicialOnzas * 100) : 0;
  let fillClass = '';
  if (pct <= 15) fillClass = 'critical';
  else if (pct <= 30) fillClass = 'low';

  if (chichaInicialOnzas <= 0) {
    el.innerHTML = `
      <div class="cs-header">
        <span class="cs-label">🧊 Chicha en envase</span>
        <span style="font-size:0.72rem;color:var(--text-light);">Día no iniciado</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:0.75rem;color:var(--text-light);">Inicia el día para comenzar a vender</span>
        <button class="btn btn-sm btn-primary" onclick="mostrarInicioDia()">🌅 Comenzar Día</button>
      </div>`;
    return;
  }

  const lugarActual = state.config.lugar_actual || '';
  el.innerHTML = `
    <div class="cs-header">
      <span class="cs-label">🧊 Chicha en envase${lugarActual ? ' 📍' + lugarActual : ''}</span>
      <span class="cs-info">${fmtCurrency(restante)} oz / ${fmtCurrency(chichaInicialOnzas)} oz</span>
    </div>
    <div class="cs-bar">
      <div class="cs-fill ${fillClass}" style="width:${pct}%"></div>
      <div class="cs-abs">${pct.toFixed(0)}%</div>
    </div>
    <div class="cs-actions">
      <button class="btn btn-sm btn-outline" onclick="document.getElementById('chichaResetDiv').classList.toggle('hidden')">Reabastecer</button>
      <span id="chichaResetDiv" class="hidden" style="display:inline-flex;gap:4px;align-items:center;">
        <input type="number" id="chichaNuevoTotal" placeholder="nuevas oz" min="0" style="width:60px;padding:4px 6px;border:2px solid var(--border);border-radius:6px;font-size:0.75rem;">
        <button class="btn btn-sm btn-primary" onclick="reabastecerChicha()">OK</button>
      </span>
    </div>
    ${restante <= 0 ? '<div style="color:var(--danger);font-size:0.75rem;font-weight:600;margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">⚠️ Chicha agotada <button class="btn btn-sm btn-outline" onclick="abrirModal(\'modalChichaAgotada\')">¿Qué hacer?</button></div>' : ''}
  `;
}

async function iniciarLoteChicha() {
  const val = parseFloat(document.getElementById('chichaInitInput').value);
  if (!val || val <= 0) { toast('Ingresa una cantidad válida'); return; }
  try {
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(val) });
    toast('Lote iniciado: ' + val + ' oz');
    renderVender();
  } catch(e) { toast('Error'); }
}

async function reabastecerChicha() {
  const extra = parseFloat(document.getElementById('chichaNuevoTotal')?.value || prompt('Onzas a agregar:'));
  if (!extra || extra <= 0) { toast('Ingresa una cantidad'); return; }
  const nuevoTotal = chichaInicialOnzas + extra;
  try {
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(nuevoTotal) });
    toast('Reabastecido: +' + extra + ' oz');
    cerrarModal('modalChichaAgotada');
    renderVender();
  } catch(e) { toast('Error'); }
}

// ===================== INICIO / CIERRE DE DÍA =====================
async function mostrarInicioDia() {
  // Load used places for datalist
  try {
    const config = await api('GET', '/config');
    state.config = config;
    const lugares = config.lugares_usados ? JSON.parse(config.lugares_usados) : [];
    const dl = document.getElementById('listaLugares');
    dl.innerHTML = lugares.map(l => `<option value="${l}">`).join('');
  } catch(e) {}
  // Set default values from config
  document.getElementById('inicioTasa').value = state.config.tasa_dolar || '';
  document.getElementById('inicioOnzas').value = state.config.receta_total_onzas || '720';
  document.getElementById('inicioLugar').value = state.config.lugar_actual || '';
  abrirModal('modalInicioDia');
}

async function comenzarDia() {
  const tasa = parseFloat(document.getElementById('inicioTasa').value);
  const onzas = parseFloat(document.getElementById('inicioOnzas').value);
  const lugar = document.getElementById('inicioLugar').value.trim();
  if (!tasa || tasa <= 0) { toast('Ingresa la tasa del dólar'); return; }
  if (!onzas || onzas <= 0) { toast('Ingresa las onzas iniciales'); return; }
  try {
    await api('PUT', '/config', { key: 'tasa_dolar', value: String(tasa) });
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: String(onzas) });
    await api('PUT', '/config', { key: 'lugar_actual', value: lugar });

    // Save place to used places list
    if (lugar) {
      const config = await api('GET', '/config');
      const lugares = config.lugares_usados ? JSON.parse(config.lugares_usados) : [];
      if (!lugares.includes(lugar)) {
        lugares.push(lugar);
        await api('PUT', '/config', { key: 'lugares_usados', value: JSON.stringify(lugares) });
      }
    }

    toast('🌅 Día iniciado: ' + onzas + ' oz · Tasa: Bs ' + tasa.toFixed(2) + (lugar ? ' · ' + lugar : ''));
    cerrarModal('modalInicioDia');
    state.config.tasa_dolar = String(tasa);
    state.config.lugar_actual = lugar;
    renderAll();
  } catch(e) { toast('Error: ' + e.message); }
}

async function cerrarDia() {
  if (!confirm('¿Cerrar el día? Se reseteará la chicha y podrás empezar de nuevo.')) return;
  try {
    await api('PUT', '/config', { key: 'chicha_inicial_onzas', value: '0' });
    toast('🔚 Día cerrado');
    cerrarModal('modalChichaAgotada');
    renderAll();
  } catch(e) { toast('Error'); }
}

let vendedorActivo = null;
function guardarVendedorActivo() {
  const sel = document.getElementById('vendedorSelect');
  vendedorActivo = sel ? parseInt(sel.value) : null;
}

function getVendedorActivo() {
  if (vendedorActivo === null || vendedorActivo === undefined) {
    const sel = document.getElementById('vendedorSelect');
    if (sel) vendedorActivo = parseInt(sel.value);
  }
  return vendedorActivo;
}

// ===================== VENTAS =====================
let monedaSeleccionada = 'USD';
let metodoPagoSeleccionado = 'efectivo';

function seleccionarMoneda(mon) {
  monedaSeleccionada = mon;
  document.querySelectorAll('#modalMoneda .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === mon);
  });
  const pmRow = document.getElementById('modalMetodoPagoRow');
  const optPM = document.getElementById('optPagoMovil');
  if (mon === 'USD') {
    metodoPagoSeleccionado = 'efectivo';
    if (optPM) optPM.classList.add('hidden');
    document.querySelectorAll('#modalMetodoPago .mp-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.val === 'efectivo');
    });
  } else {
    if (optPM) optPM.classList.remove('hidden');
  }
}

function seleccionarMetodoPago(mp) {
  metodoPagoSeleccionado = mp;
  document.querySelectorAll('#modalMetodoPago .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === mp);
  });
}

function iniciarVenta(tipo, id, nombre, precioUsd) {
  state.ventaPendiente = { tipo_producto: tipo, producto_id: id, producto_nombre: nombre, precio_usd: precioUsd };

  // Reset payment selections
  monedaSeleccionada = 'USD';
  metodoPagoSeleccionado = 'efectivo';
  document.querySelectorAll('#modalMoneda .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === 'USD');
  });
  document.querySelectorAll('#modalMetodoPago .mp-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.val === 'efectivo');
  });
  document.getElementById('optPagoMovil').classList.add('hidden');

  document.getElementById('modalProductoName').textContent = nombre;
  const v = calcVes(precioUsd);
  document.getElementById('modalProductoPrecio').innerHTML =
    `<strong>$${fmtCurrency(precioUsd)}</strong>${v > 0 ? ` &nbsp;|&nbsp; <strong>${fmtVes(v)}</strong>` : ''}`;

  // Load clients into modal
  const sel = document.getElementById('modalCliente');
  sel.innerHTML = '<option value="">Sin cliente</option>';
  api('GET', '/clientes').then(clientes => {
    clientes.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
    });
  }).catch(() => {});

  abrirModal('modalVenta');
}

async function confirmarVenta() {
  if (!state.ventaPendiente) return;
  const body = { ...state.ventaPendiente };
  body.moneda = monedaSeleccionada;
  body.metodo_pago = metodoPagoSeleccionado;
  body.vendedor_id = getVendedorActivo();
  body.lugar = state.config.lugar_actual || '';
  const cid = document.getElementById('modalCliente').value;
  if (cid) body.cliente_id = parseInt(cid);
  try {
    const venta = await api('POST', '/ventas', body);
    toast('✅ ' + venta.producto_nombre + ' vendido!');
    state.ventaPendiente = null;
    cerrarModal('modalVenta');
    renderVender();
    // Check if chicha just ran out
    if (body.tipo_producto === 'chicha') {
      checkChichaAgotada();
    }
  } catch(e) {
    toast('Error: ' + e.message);
  }
}

async function checkChichaAgotada() {
  try {
    const config = await api('GET', '/config');
    const inicial = parseFloat(config.chicha_inicial_onzas) || 0;
    if (inicial <= 0) return;
    const hoy = todayStr();
    const ventasHoy = await api('GET', `/ventas?desde=${hoy}&hasta=${hoy}`);
    let vendido = 0;
    ventasHoy.forEach(v => {
      if (v.tipo_producto === 'chicha') {
        const tam = state.tamanos.find(t => t.id === v.producto_id);
        vendido += tam ? (tam.onzaxvaso || 0) : 0;
      }
    });
    if (inicial - vendido <= 0) {
      setTimeout(() => abrirModal('modalChichaAgotada'), 500);
    }
  } catch(e) {}
}

// ===================== HISTORIAL =====================
async function cargarHistorial() {
  const desde = document.getElementById('filterDesde').value || todayStr();
  const hasta = document.getElementById('filterHasta').value || todayStr();
  const vendedor = document.getElementById('filterVendedor').value;
  let url = '/ventas?desde=' + desde + '&hasta=' + hasta;
  if (vendedor) url += '&vendedor_id=' + vendedor;

  try {
    const ventas = await api('GET', url);
    renderHistorial(ventas);
  } catch(e) {
    toast('Error al cargar historial');
  }
}

function renderHistorial(ventas) {
  const totalsEl = document.getElementById('historialTotals');
  const listEl = document.getElementById('historialList');

  // Set default filters
  if (!document.getElementById('filterDesde').value) {
    document.getElementById('filterDesde').value = todayStr();
    document.getElementById('filterHasta').value = todayStr();
  }

  // Populate seller filter
  const selV = document.getElementById('filterVendedor');
  selV.innerHTML = '<option value="">Todos los vendedores</option>' +
    state.vendedores.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('');

  const totalUsd = ventas.reduce((s, x) => s + x.precio_usd, 0);
  const totalVes = ventas.reduce((s, x) => s + x.precio_ves, 0);
  const bsEf = ventas.filter(v => v.moneda === 'VES' && v.metodo_pago === 'efectivo').reduce((s, x) => s + x.precio_ves, 0);
  const bsPM = ventas.filter(v => v.moneda === 'VES' && v.metodo_pago === 'pago_movil').reduce((s, x) => s + x.precio_ves, 0);

  totalsEl.innerHTML = `
    <div class="ht-item"><div class="ht-label">Ventas</div><div class="ht-value" style="color:var(--text);">${ventas.length}</div></div>
    <div class="ht-item"><div class="ht-label">💵 USD</div><div class="ht-value usd">$${fmtCurrency(totalUsd)}</div></div>
    <div class="ht-item"><div class="ht-label">💵 Bs Efec.</div><div class="ht-value ves">${bsEf > 0 ? fmtVes(bsEf) : '0'}</div></div>
    <div class="ht-item"><div class="ht-label">📱 Bs P.Móvil</div><div class="ht-value ves">${bsPM > 0 ? fmtVes(bsPM) : '0'}</div></div>
  `;

  if (ventas.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No hay ventas en este período</div>';
    return;
  }

  function iconoPago(moneda, metodo) {
    if (moneda === 'USD') return '💵';
    return metodo === 'pago_movil' ? '📱' : '💵';
  }
  function labelMoneda(moneda) {
    return moneda === 'USD' ? '$' : 'Bs';
  }

  let html = '';
  ventas.forEach(v => {
    const vendedor = v.vendedor_nombre ? ' · ' + v.vendedor_nombre : '';
    const cliente = v.cliente_nombre ? ' · ' + v.cliente_nombre : '';
    const lugar = v.lugar ? ' 📍' + v.lugar : '';
    const pagoIcon = iconoPago(v.moneda, v.metodo_pago);
    const pagoLabel = v.metodo_pago === 'pago_movil' ? 'Pago Móvil' : 'Efectivo';
    const monedaLabel = v.moneda === 'USD' ? 'USD' : 'Bs';
    html += `<div class="history-item">
      <div class="hi-left">
        <div class="hi-time">${fmtDate(v.creado_en)} ${fmtTime(v.creado_en)}</div>
        <div class="hi-name">${v.producto_nombre}</div>
        <div class="hi-meta">${pagoIcon} ${monedaLabel} · ${pagoLabel}${vendedor}${cliente}${lugar}</div>
      </div>
      <div class="hi-right">
        <div class="hi-usd">$${fmtCurrency(v.precio_usd)}</div>
        <div class="hi-ves">${v.precio_ves > 0 ? fmtVes(v.precio_ves) : 'Bs 0'}</div>
      </div>
      <button class="hi-delete" onclick="eliminarVenta(${v.id})">✕</button>
    </div>`;
  });
  listEl.innerHTML = html;
}

async function eliminarVenta(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  try {
    await api('DELETE', '/ventas/' + id);
    toast('Venta eliminada');
    cargarHistorial();
    renderVender();
  } catch(e) { toast('Error'); }
}

async function borrarTodasLasVentas() {
  if (!confirm('¿Borrar TODAS las ventas?')) return;
  if (!confirm('¿Seguro? No se puede deshacer.')) return;
  try {
    const ventas = await api('GET', '/ventas');
    for (const v of ventas) {
      await api('DELETE', '/ventas/' + v.id);
    }
    toast('Historial borrado');
    cargarHistorial();
    renderVender();
  } catch(e) { toast('Error'); }
}

// ===================== REPORTES =====================
async function cargarReportes() {
  const rango = document.getElementById('reporteRango').value;
  let desde, hasta;
  const hoy = new Date();
  const hoyStr = todayStr();

  if (rango === 'hoy') { desde = hoyStr; hasta = hoyStr; }
  else if (rango === 'semana') {
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - inicio.getDay());
    desde = inicio.toISOString().slice(0,10);
    hasta = hoyStr;
  } else if (rango === 'mes') {
    desde = hoyStr.slice(0,7) + '-01';
    hasta = hoyStr;
  } else {
    desde = '2000-01-01';
    hasta = '2099-12-31';
  }

  try {
    const data = await api('GET', `/reportes/resumen?desde=${desde}&hasta=${hasta}`);
    renderReportes(data);
  } catch(e) {
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
      <div class="report-card"><div class="rc-label">💵 USD</div><div class="rc-value usd">$${fmtCurrency(t.total_usd)}</div></div>
      <div class="report-card"><div class="rc-label">💵 Bs Efectivo</div><div class="rc-value ves">${d.bs_efectivo.ves > 0 ? fmtVes(d.bs_efectivo.ves) : '0'}</div></div>
      <div class="report-card"><div class="rc-label">📱 Bs P.Móvil</div><div class="rc-value ves">${d.bs_pago_movil.ves > 0 ? fmtVes(d.bs_pago_movil.ves) : '0'}</div></div>
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
    if (m === 'USD') return '💵 USD';
    return mp === 'pago_movil' ? '📱 Bs Pago Móvil' : '💵 Bs Efectivo';
  };
  let rows = pagoDesglose.map(p =>
    `<div class="rt-row">
      <span class="rt-name">${icono(p.moneda, p.metodo_pago)}</span>
      <span class="rt-val">${p.cantidad} ventas · $${fmtCurrency(p.total_usd)} · ${p.total_ves > 0 ? fmtVes(p.total_ves) : 'Bs 0'}</span>
    </div>`
  ).join('');
  return `<div class="report-section"><h3>💳 Desglose de pagos</h3><div class="report-table">${rows}</div></div>`;
}

function renderMasVendido(items) {
  if (!items || items.length === 0) return '';
  let rows = items.map(i =>
    `<div class="rt-row"><span class="rt-name">${i.producto_nombre}</span><span class="rt-val">${i.cantidad} ventas · $${fmtCurrency(i.total)}</span></div>`
  ).join('');
  return `<div class="report-section"><h3>🔥 Más vendido</h3><div class="report-table">${rows}</div></div>`;
}

function renderPorVendedor(items) {
  if (!items || items.length === 0) return '';
  let rows = items.map(i =>
    `<div class="rt-row"><span class="rt-name">${i.nombre || 'Sin vendedor'}</span><span class="rt-val">${i.cantidad} · $${fmtCurrency(i.total)}</span></div>`
  ).join('');
  return `<div class="report-section"><h3>👤 Por vendedor</h3><div class="report-table">${rows}</div></div>`;
}

function renderPorDia(items) {
  if (!items || items.length === 0) return '';
  let rows = items.map(i =>
    `<div class="rt-row"><span class="rt-name">${fmtDateShort(i.dia)}</span><span class="rt-val">${i.cantidad} ventas · $${fmtCurrency(i.total)}</span></div>`
  ).join('');
  return `<div class="report-section"><h3>📅 Por día</h3><div class="report-table">${rows}</div></div>`;
}

// ===================== INVENTARIO =====================
async function cargarInventario() {
  try {
    const items = await api('GET', '/inventario');
    renderInventario(items);
  } catch(e) { toast('Error al cargar inventario'); }
}

function renderInventario(items) {
  const el = document.getElementById('inventarioList');
  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state">No hay items en inventario</div>';
    return;
  }
  let html = '';
  items.forEach(i => {
    const isLow = i.stock_minimo > 0 && i.stock <= i.stock_minimo;
    html += `<div class="inv-card">
      <div class="ic-left">
        <div class="ic-name">${i.nombre}</div>
        <div class="ic-stock ${isLow ? 'low' : ''}">${i.stock} ${i.unidad} ${isLow ? '⚠️ Stock bajo' : ''}${i.stock_minimo > 0 ? ' (mín: '+i.stock_minimo+')' : ''}</div>
      </div>
      <div class="ic-right">
        <button class="btn btn-sm btn-outline" onclick="mostrarModalMovimiento(${i.id},'${i.nombre}')">Ajustar</button>
        <button class="btn btn-sm btn-outline" onclick="editarInventario(${i.id},'${i.nombre}','${i.unidad}',${i.stock},${i.stock_minimo})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarInventario(${i.id})">✕</button>
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

function mostrarModalInventario() {
  state.inventarioEditId = null;
  document.getElementById('modalInvTitle').textContent = '📦 Nuevo Item';
  document.getElementById('invEditId').value = '';
  document.getElementById('invNombre').value = '';
  document.getElementById('invUnidad').value = 'unidad';
  document.getElementById('invStock').value = '0';
  document.getElementById('invStockMin').value = '0';
  abrirModal('modalInventarioForm');
}

function editarInventario(id, nombre, unidad, stock, stockMin) {
  state.inventarioEditId = id;
  document.getElementById('modalInvTitle').textContent = '✏️ Editar Item';
  document.getElementById('invEditId').value = id;
  document.getElementById('invNombre').value = nombre;
  document.getElementById('invUnidad').value = unidad;
  document.getElementById('invStock').value = stock;
  document.getElementById('invStockMin').value = stockMin;
  abrirModal('modalInventarioForm');
}

async function guardarInventario() {
  const nombre = document.getElementById('invNombre').value.trim();
  if (!nombre) { toast('Escribe un nombre'); return; }
  const editId = document.getElementById('invEditId').value;
  try {
    if (editId) {
      await api('PUT', '/inventario/' + editId, {
        nombre,
        unidad: document.getElementById('invUnidad').value,
        stock: parseFloat(document.getElementById('invStock').value) || 0,
        stock_minimo: parseFloat(document.getElementById('invStockMin').value) || 0,
      });
      toast('Item actualizado');
    } else {
      await api('POST', '/inventario', {
        nombre,
        unidad: document.getElementById('invUnidad').value,
        stock: parseFloat(document.getElementById('invStock').value) || 0,
        stock_minimo: parseFloat(document.getElementById('invStockMin').value) || 0,
      });
      toast('Item agregado');
    }
    cerrarModal('modalInventarioForm');
    cargarInventario();
  } catch(e) { toast('Error: ' + e.message); }
}

async function eliminarInventario(id) {
  if (!confirm('¿Eliminar este item del inventario?')) return;
  try {
    await api('DELETE', '/inventario/' + id);
    toast('Item eliminado');
    cargarInventario();
  } catch(e) { toast('Error'); }
}

function mostrarModalMovimiento(id, nombre) {
  document.getElementById('movInvItemId').value = id;
  document.getElementById('movInvNombre').textContent = nombre;
  document.getElementById('movInvCantidad').value = '';
  document.getElementById('movInvNota').value = '';
  abrirModal('modalInvMovimiento');
}

async function guardarMovimientoInv() {
  const id = document.getElementById('movInvItemId').value;
  const cantidad = parseFloat(document.getElementById('movInvCantidad').value);
  if (!cantidad || cantidad <= 0) { toast('Ingresa una cantidad válida'); return; }
  const tipo = document.getElementById('movInvTipo').value;
  const nota = document.getElementById('movInvNota').value.trim();
  try {
    await api('POST', `/inventario/${id}/movimientos`, { cantidad, tipo, nota });
    toast('Stock actualizado');
    cerrarModal('modalInvMovimiento');
    cargarInventario();
  } catch(e) { toast('Error: ' + e.message); }
}

// ===================== RECETA (costos) =====================
function switchSubTab(subtab) {
  document.querySelectorAll('#tabInventario .subtab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('subtab' + subtab.charAt(0).toUpperCase() + subtab.slice(1)).classList.add('active');
  document.querySelectorAll('#tabInventario .sub-tab').forEach(el => el.classList.remove('active'));
  document.querySelector(`#tabInventario .sub-tab[data-subtab="${subtab}"]`).classList.add('active');
  if (subtab === 'receta') cargarReceta();
  if (subtab === 'items') cargarInventario();
}

async function cargarReceta() {
  try {
    const [ingredientes, config, tamanos] = await Promise.all([
      api('GET', '/receta/ingredientes'),
      api('GET', '/config'),
      api('GET', '/tamanos'),
    ]);
    state.config = config;
    const batchSize = parseFloat(config.receta_batch_size) || 10;
    const batchUnidad = config.receta_batch_unidad || 'kg';
    renderReceta(ingredientes, tamanos, batchSize, batchUnidad);
  } catch(e) {
    toast('Error al cargar receta');
  }
}

function renderReceta(ingredientes, tamanos, batchSize, batchUnidad) {
  const el = document.getElementById('recetaContent');

  const totalCosto = ingredientes.reduce((s, i) => s + (i.cantidad || 0) * (i.precio_unitario || 0), 0);
  let totalOnzas = parseFloat(state.config.receta_total_onzas) || 120;
  const costoPorOnza = totalOnzas > 0 && totalCosto > 0 ? totalCosto / totalOnzas : 0;

  // Ingredients list
  let ingHtml = '';
  if (ingredientes.length === 0) {
    ingHtml = '<div class="empty-state">Agrega ingredientes para calcular costos</div>';
  } else {
    ingHtml = ingredientes.map(i => {
      const costo = (i.cantidad || 0) * (i.precio_unitario || 0);
      return `<div class="receta-ing-item">
        <div class="ri-left">
          <div class="ri-name">${i.nombre}</div>
          <div class="ri-meta">${i.cantidad} ${i.unidad} × $${fmtCurrency(i.precio_unitario)}/${i.unidad}</div>
        </div>
        <div class="ri-right">
          <span class="ri-costo">$${fmtCurrency(costo)}</span>
          <button class="btn btn-sm btn-outline" onclick="editarPrecioIngrediente(${i.id},'${i.nombre}',${i.cantidad},'${i.unidad}',${i.precio_unitario})">💲</button>
        </div>
      </div>`;
    }).join('');
  }

  // Results per size
  let resultsHtml = '';
  if (ingredientes.length > 0) {
    let rowsHtml = tamanos.map(t => {
      const onzas = t.onzaxvaso || 0;
      const costoUnidad = costoPorOnza * onzas;
      const ganancia = t.precio_usd - costoUnidad;
      const margen = t.precio_usd > 0 ? (ganancia / t.precio_usd * 100) : 0;
      const gananciaCls = ganancia >= 0 ? 'pos' : 'neg';
      const gananciaStr = ganancia >= 0 ? `+$${fmtCurrency(ganancia)}` : `-$${fmtCurrency(Math.abs(ganancia))}`;
      const vasosLote = onzas > 0 ? Math.floor(totalOnzas / onzas) : 0;
      return `<div class="rr-row">
        <span class="rr-name">${t.nombre}</span>
        <div class="rr-datos">
          Onzas: <input type="number" value="${onzas || ''}" min="0" step="1" onchange="actualizarOnzas(${t.id}, this.value)" placeholder="0" style="width:50px;">
          <span>│ Costo: $${fmtCurrency(costoUnidad)}</span>
          <span>│ Venta: $${fmtCurrency(t.precio_usd)}</span>
          ${vasosLote > 0 ? `<span>│ ~${vasosLote}/lote</span>` : ''}
        </div>
        <span class="rr-ganancia ${gananciaCls}">${gananciaStr} (${margen.toFixed(1)}%)</span>
      </div>`;
    }).join('');
    resultsHtml = `<div class="receta-results"><h3>📊 Resultados por tamaño</h3>${rowsHtml}</div>`;
  }

  el.innerHTML = `
    <div class="receta-header">
      <h3>🧪 Costos de producción</h3>
      <button class="btn btn-sm btn-primary" onclick="mostrarModalIngrediente()">+ Ingrediente</button>
    </div>

    <div class="receta-batch">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%;">
        <label>Lote:</label>
        <input type="number" id="recetaBatchSize" value="${batchSize}" min="0" step="0.5" onchange="guardarBatchSize()" style="width:70px;">
        <span>${batchUnidad}</span>
        <label style="margin-left:8px;">Rinde:</label>
        <input type="number" id="recetaTotalOnzas" value="${totalOnzas}" min="0" step="1" onchange="guardarTotalOnzas()" style="width:60px;">
        <span>onzas</span>
        <span style="margin-left:auto;font-size:0.8rem;color:var(--text-light);">Costo/onza:</span>
        <span class="receta-total">$${costoPorOnza > 0 ? fmtCurrency(costoPorOnza) : '0.00'}</span>
      </div>
      <div style="display:flex;gap:10px;width:100%;margin-top:6px;font-size:0.8rem;color:var(--text-light);">
        <span>Costo total lote: <strong style="color:var(--text);">$${fmtCurrency(totalCosto)}</strong></span>
      </div>
    </div>

    <div class="receta-ingredientes">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">🥣 Ingredientes</h3>
      ${ingHtml}
    </div>

    ${resultsHtml}

      <div style="margin-top:12px;padding:8px 0;font-size:0.7rem;color:var(--text-light);text-align:center;">
        Precio por onza = costo del lote ÷ onzas totales. El costo por vaso = onzas del vaso × costo/onza.<br>
        Las cantidades de ingredientes son fijas para 10 kg de chicha. Solo actualiza los precios.<br>
        💡 Próximamente: costos de vasos, pitillos y servilletas.
      </div>
  `;
}

function mostrarModalIngrediente() {
  state.ingEditId = null;
  document.getElementById('modalIngTitle').textContent = '🧪 Agregar Ingrediente';
  document.getElementById('ingEditId').value = '';
  document.getElementById('ingNombre').value = '';
  document.getElementById('ingNombre').readOnly = false;
  document.getElementById('ingCantidad').value = '';
  document.getElementById('ingUnidad').value = 'kg';
  document.getElementById('ingPrecio').value = '';
  document.getElementById('ingCantField').style.display = '';
  document.getElementById('ingUnidadField').style.display = 'none';
  abrirModal('modalIngrediente');
}

function editarPrecioIngrediente(id, nombre, cantidad, unidad, precio) {
  state.ingEditId = id;
  document.getElementById('modalIngTitle').textContent = '💲 Precio: ' + nombre;
  document.getElementById('ingEditId').value = id;
  document.getElementById('ingNombre').value = nombre;
  document.getElementById('ingNombre').readOnly = true;
  document.getElementById('ingCantidad').value = cantidad;
  document.getElementById('ingUnidad').value = unidad;
  document.getElementById('ingPrecio').value = precio;
  document.getElementById('ingCantField').style.display = 'none';
  document.getElementById('ingUnidadField').style.display = '';
  document.getElementById('ingUnidadTexto').textContent = cantidad + ' ' + unidad + ' (fijo)';
  abrirModal('modalIngrediente');
}

async function guardarIngrediente() {
  const nombre = document.getElementById('ingNombre').value.trim();
  if (!nombre) { toast('Escribe el nombre'); return; }
  const editId = document.getElementById('ingEditId').value;
  const data = {
    nombre,
    cantidad: parseFloat(document.getElementById('ingCantidad').value) || 0,
    unidad: document.getElementById('ingUnidad').value,
    precio_unitario: parseFloat(document.getElementById('ingPrecio').value) || 0,
  };
  try {
    if (editId) {
      await api('PUT', '/receta/ingredientes/' + editId, data);
      toast('Ingrediente actualizado');
    } else {
      await api('POST', '/receta/ingredientes', data);
      toast('Ingrediente agregado');
    }
    cerrarModal('modalIngrediente');
    cargarReceta();
  } catch(e) { toast('Error: ' + e.message); }
}

async function eliminarIngrediente(id) {
  if (!confirm('¿Eliminar este ingrediente?')) return;
  try {
    await api('DELETE', '/receta/ingredientes/' + id);
    toast('Ingrediente eliminado');
    cargarReceta();
  } catch(e) { toast('Error'); }
}
async function actualizarRendimiento(tamanoId, valor) {
  const rend = parseInt(valor) || 0;
  try {
    await api('PUT', '/receta/tamano/' + tamanoId, { onzaxvaso: rend });
    const t = state.tamanos.find(x => x.id === tamanoId);
    if (t) t.onzaxvaso = rend;
    cargarReceta();
  } catch(e) { toast('Error'); }
}

async function actualizarOnzas(tamanoId, valor) {
  const onzas = parseFloat(valor) || 0;
  try {
    await api('PUT', '/receta/tamano/' + tamanoId, { onzaxvaso: onzas });
    const t = state.tamanos.find(x => x.id === tamanoId);
    if (t) t.onzaxvaso = onzas;
    cargarReceta();
  } catch(e) { toast('Error'); }
}

async function guardarBatchSize() {
  const val = document.getElementById('recetaBatchSize').value;
  try {
    await api('PUT', '/config', { key: 'receta_batch_size', value: String(val) });
    cargarReceta();
  } catch(e) { toast('Error'); }
}

async function guardarTotalOnzas() {
  const val = document.getElementById('recetaTotalOnzas').value;
  state.config.receta_total_onzas = val;
  try {
    await api('PUT', '/config', { key: 'receta_total_onzas', value: String(val) });
    cargarReceta();
  } catch(e) { toast('Error'); }
}

// ===================== CLIENTES =====================
async function cargarClientes() {
  const q = document.getElementById('buscarCliente').value.trim();
  try {
    const url = q ? '/clientes?q=' + encodeURIComponent(q) : '/clientes';
    const clientes = await api('GET', url);
    renderClientes(clientes);
  } catch(e) { toast('Error al cargar clientes'); }
}

function renderClientes(clientes) {
  const el = document.getElementById('clientesList');
  if (clientes.length === 0) {
    el.innerHTML = '<div class="empty-state">No hay clientes registrados</div>';
    return;
  }
  let html = '';
  clientes.forEach(c => {
    html += `<div class="client-card" onclick="verCliente(${c.id})">
      <div class="cc-left">
        <div class="cc-name">${c.nombre}</div>
        <div class="cc-meta">${c.telefono ? c.telefono + ' · ' : ''}${c.total_ventas || 0} compras</div>
      </div>
      <div class="cc-right">${c.notas ? '📝' : ''}</div>
    </div>`;
  });
  el.innerHTML = html;
}

function mostrarModalCliente() {
  state.clienteEditId = null;
  document.getElementById('modalClienteTitle').textContent = '👤 Nuevo Cliente';
  document.getElementById('clienteEditId').value = '';
  document.getElementById('clienteNombre').value = '';
  document.getElementById('clienteTelefono').value = '';
  document.getElementById('clienteNotas').value = '';
  abrirModal('modalClienteForm');
}

function editarCliente(id, nombre, telefono, notas) {
  state.clienteEditId = id;
  document.getElementById('modalClienteTitle').textContent = '✏️ Editar Cliente';
  document.getElementById('clienteEditId').value = id;
  document.getElementById('clienteNombre').value = nombre;
  document.getElementById('clienteTelefono').value = telefono || '';
  document.getElementById('clienteNotas').value = notas || '';
  abrirModal('modalClienteForm');
}

async function guardarCliente() {
  const nombre = document.getElementById('clienteNombre').value.trim();
  if (!nombre) { toast('Escribe el nombre'); return; }
  const editId = document.getElementById('clienteEditId').value;
  const data = {
    nombre,
    telefono: document.getElementById('clienteTelefono').value.trim(),
    notas: document.getElementById('clienteNotas').value.trim(),
  };
  try {
    if (editId) {
      await api('PUT', '/clientes/' + editId, data);
      toast('Cliente actualizado');
    } else {
      await api('POST', '/clientes', data);
      toast('Cliente agregado');
    }
    cerrarModal('modalClienteForm');
    cargarClientes();
  } catch(e) { toast('Error: ' + e.message); }
}

async function verCliente(id) {
  state.clienteActualId = id;
  try {
    const [cliente, ventas] = await Promise.all([
      api('GET', '/clientes?q=' + id).then(clientes => clientes.find(c => c.id === id)),
      api('GET', '/clientes/' + id + '/ventas'),
    ]);
    if (!cliente) { toast('Cliente no encontrado'); return; }
    document.getElementById('detalleClienteNombre').textContent = '👤 ' + cliente.nombre;
    document.getElementById('detalleClienteInfo').innerHTML = `
      ${cliente.telefono ? '<p style="font-size:0.85rem;color:var(--text-light)">📞 ' + cliente.telefono + '</p>' : ''}
      ${cliente.notas ? '<p style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">📝 ' + cliente.notas + '</p>' : ''}
      <p style="font-size:0.85rem;margin-top:8px;"><strong>Total compras:</strong> ${ventas.length} · <strong>Total:</strong> $${fmtCurrency(ventas.reduce((s,v) => s + v.precio_usd, 0))}</p>
    `;
    const ventasEl = document.getElementById('detalleClienteVentas');
    if (ventas.length === 0) {
      ventasEl.innerHTML = '<div style="color:var(--text-light);font-size:0.8rem;">Sin compras registradas</div>';
    } else {
      ventasEl.innerHTML = ventas.map(v =>
        `<div class="mv-item"><span>${fmtDate(v.creado_en)} ${v.producto_nombre}</span><span>$${fmtCurrency(v.precio_usd)}</span></div>`
      ).join('');
    }
    abrirModal('modalClienteDetalle');
  } catch(e) { toast('Error al cargar cliente'); }
}

async function eliminarClienteActual() {
  if (!state.clienteActualId) return;
  if (!confirm('¿Eliminar este cliente?')) return;
  try {
    await api('DELETE', '/clientes/' + state.clienteActualId);
    toast('Cliente eliminado');
    cerrarModal('modalClienteDetalle');
    cargarClientes();
  } catch(e) { toast('Error'); }
}

// ===================== CONFIG =====================
function renderConfig() {
  renderHeader();

  const el = document.getElementById('configContent');
  const tasa = getTasa();

  let sizesHtml = state.tamanos.map(s => `
    <div class="config-item">
      <div class="ci-header"><span>${s.nombre}</span><button class="btn btn-danger btn-sm" onclick="eliminarTamano(${s.id})">Eliminar</button></div>
      <div class="config-row">
        <input class="cname" type="text" value="${s.nombre}" placeholder="Nombre" onchange="actualizarTamano(${s.id},'nombre',this.value)">
        <label>USD:</label>
        <input type="number" step="0.01" min="0" value="${s.precio_usd}" placeholder="0.00" onchange="actualizarTamano(${s.id},'precio_usd',parseFloat(this.value)||0)">
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-light);font-size:0.8rem;padding:8px 0;">Sin tamaños</div>';

  let prodHtml = state.otrosProductos.map(p => `
    <div class="config-item">
      <div class="ci-header"><span>${p.nombre}</span><button class="btn btn-danger btn-sm" onclick="eliminarOtroProducto(${p.id})">Eliminar</button></div>
      <div class="config-row">
        <input class="cname" type="text" value="${p.nombre}" placeholder="Nombre" onchange="actualizarOtroProducto(${p.id},'nombre',this.value)">
        <label>USD:</label>
        <input type="number" step="0.01" min="0" value="${p.precio_usd}" placeholder="0.00" onchange="actualizarOtroProducto(${p.id},'precio_usd',parseFloat(this.value)||0)">
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-light);font-size:0.8rem;padding:8px 0;">Sin productos</div>';

  let vendedoresHtml = state.vendedores.map(v => `
    <div class="config-item">
      <div class="ci-header"><span>${v.nombre}</span><button class="btn btn-danger btn-sm" onclick="eliminarVendedor(${v.id})">Eliminar</button></div>
      <div class="config-row">
        <input class="cname" type="text" value="${v.nombre}" placeholder="Nombre" onchange="actualizarVendedor(${v.id},this.value)">
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-light);font-size:0.8rem;padding:8px 0;">Sin vendedores</div>';

  el.innerHTML = `
    <div class="config-section">
      <h3>💵 Tasa del Dólar</h3>
      <div class="config-card">
        <div class="config-rate">
          <input type="number" id="configTasa" value="${tasa > 0 ? tasa : ''}" placeholder="0.00" step="0.01" min="0">
          <span style="font-weight:700;color:var(--text-light);">Bs/$</span>
          <button class="btn btn-primary" onclick="guardarTasa()">Guardar</button>
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3>🥤 Tamaños de Chicha <button class="btn btn-sm btn-primary" onclick="agregarTamano()">+</button></h3>
      <div class="config-card">${sizesHtml}</div>
    </div>

    <div class="config-section">
      <h3>🍽️ Otros Productos <button class="btn btn-sm btn-primary" onclick="agregarOtroProducto()">+</button></h3>
      <div class="config-card">${prodHtml}</div>
    </div>

    <div class="config-section">
      <h3>👤 Vendedores <button class="btn btn-sm btn-primary" onclick="agregarVendedor()">+</button></h3>
      <div class="config-card">${vendedoresHtml}</div>
    </div>

    <div style="text-align:center;margin-top:20px;padding:16px;color:var(--text-light);font-size:0.7rem;">
      Los datos se guardan en el servidor (base de datos SQLite)
    </div>
  `;
}

async function guardarTasa() {
  const val = parseFloat(document.getElementById('configTasa').value);
  if (!val || val <= 0) { toast('Ingresa una tasa válida'); return; }
  try {
    await api('PUT', '/config', { key: 'tasa_dolar', value: String(val) });
    state.config.tasa_dolar = String(val);
    toast('Tasa guardada: Bs ' + val.toFixed(2));
    renderAll();
  } catch(e) { toast('Error'); }
}

async function agregarTamano() {
  try {
    await api('POST', '/tamanos', { nombre: 'Nuevo', precio_usd: 1 });
    state.tamanos = await api('GET', '/tamanos');
    renderConfig();
    toast('Tamaño agregado');
  } catch(e) { toast('Error'); }
}

async function actualizarTamano(id, field, value) {
  try {
    await api('PUT', '/tamanos/' + id, { [field]: value });
    state.tamanos = await api('GET', '/tamanos');
    renderVender();
    renderHeader();
  } catch(e) { /* ignore */ }
}

async function eliminarTamano(id) {
  if (!confirm('¿Eliminar este tamaño?')) return;
  try {
    await api('DELETE', '/tamanos/' + id);
    state.tamanos = await api('GET', '/tamanos');
    renderConfig();
    toast('Tamaño eliminado');
  } catch(e) { toast('Error'); }
}

async function agregarOtroProducto() {
  try {
    await api('POST', '/otros-productos', { nombre: 'Nuevo', precio_usd: 1 });
    state.otrosProductos = await api('GET', '/otros-productos');
    renderConfig();
    toast('Producto agregado');
  } catch(e) { toast('Error'); }
}

async function actualizarOtroProducto(id, field, value) {
  try {
    await api('PUT', '/otros-productos/' + id, { [field]: value });
    state.otrosProductos = await api('GET', '/otros-productos');
    renderVender();
    renderHeader();
  } catch(e) { /* ignore */ }
}

async function eliminarOtroProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    await api('DELETE', '/otros-productos/' + id);
    state.otrosProductos = await api('GET', '/otros-productos');
    renderConfig();
    toast('Producto eliminado');
  } catch(e) { toast('Error'); }
}

async function agregarVendedor() {
  try {
    await api('POST', '/vendedores', { nombre: 'Nuevo vendedor' });
    state.vendedores = await api('GET', '/vendedores');
    renderConfig();
    toast('Vendedor agregado');
  } catch(e) { toast('Error'); }
}

async function actualizarVendedor(id, nombre) {
  try {
    await api('PUT', '/vendedores/' + id, { nombre });
    state.vendedores = await api('GET', '/vendedores');
  } catch(e) { /* ignore */ }
}

async function eliminarVendedor(id) {
  if (!confirm('¿Eliminar este vendedor?')) return;
  try {
    await api('DELETE', '/vendedores/' + id);
    state.vendedores = await api('GET', '/vendedores');
    renderConfig();
    toast('Vendedor eliminado');
  } catch(e) { toast('Error'); }
}

// ===================== MODALS =====================
function abrirModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function cerrarModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el) el.classList.add('hidden');
  });
});

// ===================== RENDER ALL =====================
function renderAll() {
  renderHeader();
  renderVender();
  // other tabs will render when visited
}

// ===================== START =====================
document.addEventListener('DOMContentLoaded', init);
