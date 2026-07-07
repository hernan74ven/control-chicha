import { state } from './state.js';
import { api } from './api.js';
import { toast, fmtCurrency, abrirModal, cerrarModal } from './ui.js';
import { cargarInventario } from './inventario.js';

export function switchSubTab(subtab) {
  document.querySelectorAll('#tabInventario .subtab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('subtab' + subtab.charAt(0).toUpperCase() + subtab.slice(1)).classList.add('active');
  document.querySelectorAll('#tabInventario .sub-tab').forEach(el => el.classList.remove('active'));
  document.querySelector(`#tabInventario .sub-tab[data-subtab="${subtab}"]`).classList.add('active');
  if (subtab === 'receta') cargarReceta();
  if (subtab === 'items') cargarInventario();
}

export async function cargarReceta() {
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
  } catch (e) {
    toast('Error al cargar receta');
  }
}

function renderReceta(ingredientes, tamanos, batchSize, batchUnidad) {
  const el = document.getElementById('recetaContent');
  const totalCosto = ingredientes.reduce((s, i) => s + (i.cantidad || 0) * (i.precio_unitario || 0), 0);
  let totalOnzas = parseFloat(state.config.receta_total_onzas) || 120;
  const costoPorOnza = totalOnzas > 0 && totalCosto > 0 ? totalCosto / totalOnzas : 0;

  let ingHtml = '';
  if (ingredientes.length === 0) {
    ingHtml = '<div class="empty-state">Agrega ingredientes para calcular costos</div>';
  } else {
    ingHtml = ingredientes.map(i => {
      const costo = (i.cantidad || 0) * (i.precio_unitario || 0);
      return `<div class="receta-ing-item">
        <div class="ri-left">
          <div class="ri-name">${i.nombre}</div>
          <div class="ri-meta">${i.cantidad} ${i.unidad} x $${fmtCurrency(i.precio_unitario)}/${i.unidad}</div>
        </div>
        <div class="ri-right">
          <span class="ri-costo">$${fmtCurrency(costo)}</span>
          <button class="btn btn-sm btn-outline" onclick="window.editarPrecioIngrediente('${i.id}', '${i.nombre.replace(/'/g, "\\'")}',${i.cantidad},'${i.unidad}',${i.precio_unitario})">Precio</button>
        </div>
      </div>`;
    }).join('');
  }

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
          Onzas: <input type="number" value="${onzas || ''}" min="0" step="1" onchange="window.actualizarOnzas(${t.id}, this.value)" placeholder="0" style="width:50px;">
          <span>Costo: $${fmtCurrency(costoUnidad)}</span>
          <span>Venta: $${fmtCurrency(t.precio_usd)}</span>
          ${vasosLote > 0 ? `<span>~${vasosLote}/lote</span>` : ''}
        </div>
        <span class="rr-ganancia ${gananciaCls}">${gananciaStr} (${margen.toFixed(1)}%)</span>
      </div>`;
    }).join('');
    resultsHtml = `<div class="receta-results"><h3>Resultados por tamano</h3>${rowsHtml}</div>`;
  }

  el.innerHTML = `
    <div class="receta-header">
      <h3>Costos de produccion</h3>
      <button class="btn btn-sm btn-primary" onclick="window.mostrarModalIngrediente()">+ Ingrediente</button>
    </div>
    <div class="receta-batch">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%;">
        <label>Lote:</label>
        <input type="number" id="recetaBatchSize" value="${batchSize}" min="0" step="0.5" onchange="window.guardarBatchSize()" style="width:70px;">
        <span>${batchUnidad}</span>
        <label style="margin-left:8px;">Rinde:</label>
        <input type="number" id="recetaTotalOnzas" value="${totalOnzas}" min="0" step="1" onchange="window.guardarTotalOnzas()" style="width:60px;">
        <span>onzas</span>
        <span style="margin-left:auto;font-size:0.8rem;color:var(--text-light);">Costo/onza:</span>
        <span class="receta-total">$${costoPorOnza > 0 ? fmtCurrency(costoPorOnza) : '0.00'}</span>
      </div>
      <div style="display:flex;gap:10px;width:100%;margin-top:6px;font-size:0.8rem;color:var(--text-light);">
        <span>Costo total lote: <strong style="color:var(--text);">$${fmtCurrency(totalCosto)}</strong></span>
      </div>
    </div>
    <div class="receta-ingredientes">
      <h3 style="font-size:0.85rem;font-weight:700;margin-bottom:8px;">Ingredientes</h3>
      ${ingHtml}
    </div>
    ${resultsHtml}
    <div style="margin-top:12px;padding:8px 0;font-size:0.7rem;color:var(--text-light);text-align:center;">
      Precio por onza = costo del lote / onzas totales. El costo por vaso = onzas del vaso x costo/onza.<br>
      Las cantidades de ingredientes son fijas para 10 kg de chicha. Solo actualiza los precios.
    </div>
  `;
}

export function mostrarModalIngrediente() {
  state.ingEditId = null;
  document.getElementById('modalIngTitle').textContent = 'Agregar Ingrediente';
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

export function editarPrecioIngrediente(id, nombre, cantidad, unidad, precio) {
  state.ingEditId = id;
  document.getElementById('modalIngTitle').textContent = 'Precio: ' + nombre;
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

export async function guardarIngrediente() {
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
  } catch (e) { toast('Error: ' + e.message); }
}

export async function eliminarIngrediente(id) {
  if (!confirm('Eliminar este ingrediente?')) return;
  try {
    await api('DELETE', '/receta/ingredientes/' + id);
    toast('Ingrediente eliminado');
    cargarReceta();
  } catch (e) { toast('Error'); }
}

export async function actualizarOnzas(tamanoId, valor) {
  const onzas = parseFloat(valor) || 0;
  try {
    await api('PUT', '/receta/tamano/' + tamanoId, { onzaxvaso: onzas });
    const t = state.tamanos.find(x => x.id === tamanoId);
    if (t) t.onzaxvaso = onzas;
    cargarReceta();
  } catch (e) { toast('Error'); }
}

export async function guardarBatchSize() {
  const val = document.getElementById('recetaBatchSize').value;
  try {
    await api('PUT', '/config', { key: 'receta_batch_size', value: String(val) });
    cargarReceta();
  } catch (e) { toast('Error'); }
}

export async function guardarTotalOnzas() {
  const val = document.getElementById('recetaTotalOnzas').value;
  state.config.receta_total_onzas = val;
  try {
    await api('PUT', '/config', { key: 'receta_total_onzas', value: String(val) });
    cargarReceta();
  } catch (e) { toast('Error'); }
}
