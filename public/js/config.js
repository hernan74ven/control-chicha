import { state } from './state.js';
import { api } from './api.js';
import { toast, fmtCurrency } from './ui.js';
import { renderHeader, renderVender, getTasa } from './ventas.js';

export function renderConfig() {
  renderHeader();
  const el = document.getElementById('configContent');
  const tasa = getTasa();

  let sizesHtml = state.tamanos.map(s => `
    <div class="config-item">
      <div class="ci-header"><span>${s.nombre}</span><button class="btn btn-danger btn-sm" onclick="window.eliminarTamano('${s.id}')">Eliminar</button></div>
      <div class="config-row">
        <input class="cname" type="text" value="${s.nombre}" placeholder="Nombre" onchange="window.actualizarTamano('${s.id}','nombre',this.value)">
        <label>USD:</label>
        <input type="number" step="0.01" min="0" value="${s.precio_usd}" placeholder="0.00" onchange="window.actualizarTamano('${s.id}','precio_usd',parseFloat(this.value)||0)">
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-light);font-size:0.8rem;padding:8px 0;">Sin tamanos</div>';

  let prodHtml = state.otrosProductos.map(p => `
    <div class="config-item">
      <div class="ci-header"><span>${p.nombre}</span><button class="btn btn-danger btn-sm" onclick="window.eliminarOtroProducto('${p.id}')">Eliminar</button></div>
      <div class="config-row">
        <input class="cname" type="text" value="${p.nombre}" placeholder="Nombre" onchange="window.actualizarOtroProducto('${p.id}','nombre',this.value)">
        <label>USD:</label>
        <input type="number" step="0.01" min="0" value="${p.precio_usd}" placeholder="0.00" onchange="window.actualizarOtroProducto('${p.id}','precio_usd',parseFloat(this.value)||0)">
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-light);font-size:0.8rem;padding:8px 0;">Sin productos</div>';

  let vendedoresHtml = state.vendedores.map(v => `
    <div class="config-item">
      <div class="ci-header"><span>${v.nombre}</span><button class="btn btn-danger btn-sm" onclick="window.eliminarVendedor('${v.id}')">Eliminar</button></div>
      <div class="config-row">
        <input class="cname" type="text" value="${v.nombre}" placeholder="Nombre" onchange="window.actualizarVendedor('${v.id}',this.value)">
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-light);font-size:0.8rem;padding:8px 0;">Sin vendedores</div>';

  el.innerHTML = `
    <div class="config-section">
      <h3>Tasa del Dolar</h3>
      <div class="config-card">
        <div class="config-rate">
          <input type="number" id="configTasa" value="${tasa > 0 ? tasa : ''}" placeholder="0.00" step="0.01" min="0">
          <span style="font-weight:700;color:var(--text-light);">Bs/$</span>
          <button class="btn btn-primary" onclick="window.guardarTasa()">Guardar</button>
        </div>
      </div>
    </div>
    <div class="config-section">
      <h3>Tamanos de Chicha <button class="btn btn-sm btn-primary" onclick="window.agregarTamano()">+</button></h3>
      <div class="config-card">${sizesHtml}</div>
    </div>
    <div class="config-section">
      <h3>Otros Productos <button class="btn btn-sm btn-primary" onclick="window.agregarOtroProducto()">+</button></h3>
      <div class="config-card">${prodHtml}</div>
    </div>
    <div class="config-section">
      <h3>Vendedores <button class="btn btn-sm btn-primary" onclick="window.agregarVendedor()">+</button></h3>
      <div class="config-card">${vendedoresHtml}</div>
    </div>
      <div class="config-section">
      <h3>Firestore (Base de Datos)</h3>
      <div class="config-card" id="syncStatusCard">
        <div style="text-align:center;padding:8px;color:var(--text-light);font-size:0.8rem;">Cargando...</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:20px;padding:16px;color:var(--text-light);font-size:0.7rem;">
      Los datos se guardan en Firestore (tiempo real)
    </div>
  `;

  loadSyncStatus();
}

export async function guardarTasa() {
  const val = parseFloat(document.getElementById('configTasa').value);
  if (!val || val <= 0) { toast('Ingresa una tasa valida'); return; }
  try {
    await api('PUT', '/config', { key: 'tasa_dolar', value: String(val) });
    state.config.tasa_dolar = String(val);
    toast('Tasa guardada: Bs ' + val.toFixed(2));
    window.renderAll();
  } catch (e) { toast('Error'); }
}

export async function agregarTamano() {
  try {
    await api('POST', '/tamanos', { nombre: 'Nuevo', precio_usd: 1 });
    state.tamanos = await api('GET', '/tamanos');
    renderConfig();
    toast('Tamano agregado');
  } catch (e) { toast('Error'); }
}

export async function actualizarTamano(id, field, value) {
  try {
    await api('PUT', '/tamanos/' + id, { [field]: value });
    state.tamanos = await api('GET', '/tamanos');
    renderVender();
    renderHeader();
  } catch (e) { /* ignore */ }
}

export async function eliminarTamano(id) {
  if (!confirm('Eliminar este tamano?')) return;
  try {
    await api('DELETE', '/tamanos/' + id);
    state.tamanos = await api('GET', '/tamanos');
    renderConfig();
    toast('Tamano eliminado');
  } catch (e) { toast('Error'); }
}

export async function agregarOtroProducto() {
  try {
    await api('POST', '/otros-productos', { nombre: 'Nuevo', precio_usd: 1 });
    state.otrosProductos = await api('GET', '/otros-productos');
    renderConfig();
    toast('Producto agregado');
  } catch (e) { toast('Error'); }
}

export async function actualizarOtroProducto(id, field, value) {
  try {
    await api('PUT', '/otros-productos/' + id, { [field]: value });
    state.otrosProductos = await api('GET', '/otros-productos');
    renderVender();
    renderHeader();
  } catch (e) { /* ignore */ }
}

export async function eliminarOtroProducto(id) {
  if (!confirm('Eliminar este producto?')) return;
  try {
    await api('DELETE', '/otros-productos/' + id);
    state.otrosProductos = await api('GET', '/otros-productos');
    renderConfig();
    toast('Producto eliminado');
  } catch (e) { toast('Error'); }
}

export async function agregarVendedor() {
  try {
    await api('POST', '/vendedores', { nombre: 'Nuevo vendedor' });
    state.vendedores = await api('GET', '/vendedores');
    renderConfig();
    toast('Vendedor agregado');
  } catch (e) { toast('Error'); }
}

export async function actualizarVendedor(id, nombre) {
  try {
    await api('PUT', '/vendedores/' + id, { nombre });
    state.vendedores = await api('GET', '/vendedores');
  } catch (e) { /* ignore */ }
}

export async function eliminarVendedor(id) {
  if (!confirm('Eliminar este vendedor?')) return;
  try {
    await api('DELETE', '/vendedores/' + id);
    state.vendedores = await api('GET', '/vendedores');
    renderConfig();
    toast('Vendedor eliminado');
  } catch (e) { toast('Error'); }
}

async function loadSyncStatus() {
  const card = document.getElementById('syncStatusCard');
  if (!card) return;
  try {
    const status = await api('GET', '/sync/status');
    const lastSync = status.lastSync ? new Date(status.lastSync).toLocaleString('es-ES') : 'Nunca';
    const enabled = status.enabled;
    card.innerHTML = `
      <div class="config-row" style="flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;">Estado:</span>
          <span style="color:${enabled ? 'var(--success)' : 'var(--text-light)'};">${enabled ? 'Conectado' : 'Desconectado'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:0.8rem;color:var(--text-light);">Base de datos:</span>
          <span style="font-size:0.8rem;">Firestore (tiempo real)</span>
        </div>
      </div>
    `;
  } catch (e) {
    card.innerHTML = '<div style="color:var(--danger);font-size:0.8rem;padding:8px;">Error al cargar estado</div>';
  }
}
