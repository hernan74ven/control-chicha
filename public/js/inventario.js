import { state } from './state.js';
import { api } from './api.js';
import { toast, abrirModal, cerrarModal } from './ui.js';

export async function cargarInventario() {
  try {
    const items = await api('GET', '/inventario');
    renderInventario(items);
  } catch (e) { toast('Error al cargar inventario'); }
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
        <div class="ic-stock ${isLow ? 'low' : ''}">${i.stock} ${i.unidad} ${isLow ? 'Stock bajo' : ''}${i.stock_minimo > 0 ? ' (min: ' + i.stock_minimo + ')' : ''}</div>
      </div>
      <div class="ic-right">
        <button class="btn btn-sm btn-outline" onclick="window.mostrarModalMovimiento('${i.id}', '${i.nombre.replace(/'/g, "\\'")}')">Ajustar</button>
        <button class="btn btn-sm btn-outline" onclick="window.editarInventario('${i.id}', '${i.nombre.replace(/'/g, "\\'")}','${i.unidad}',${i.stock},${i.stock_minimo})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="window.eliminarInventario('${i.id}')">X</button>
      </div>
    </div>`;
  });
  el.innerHTML = html;
}

export function mostrarModalInventario() {
  state.inventarioEditId = null;
  document.getElementById('modalInvTitle').textContent = 'Nuevo Item';
  document.getElementById('invEditId').value = '';
  document.getElementById('invNombre').value = '';
  document.getElementById('invUnidad').value = 'unidad';
  document.getElementById('invStock').value = '0';
  document.getElementById('invStockMin').value = '0';
  abrirModal('modalInventarioForm');
}

export function editarInventario(id, nombre, unidad, stock, stockMin) {
  state.inventarioEditId = id;
  document.getElementById('modalInvTitle').textContent = 'Editar Item';
  document.getElementById('invEditId').value = id;
  document.getElementById('invNombre').value = nombre;
  document.getElementById('invUnidad').value = unidad;
  document.getElementById('invStock').value = stock;
  document.getElementById('invStockMin').value = stockMin;
  abrirModal('modalInventarioForm');
}

export async function guardarInventario() {
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
  } catch (e) { toast('Error: ' + e.message); }
}

export async function eliminarInventario(id) {
  if (!confirm('Eliminar este item del inventario?')) return;
  try {
    await api('DELETE', '/inventario/' + id);
    toast('Item eliminado');
    cargarInventario();
  } catch (e) { toast('Error'); }
}

export function mostrarModalMovimiento(id, nombre) {
  document.getElementById('movInvItemId').value = id;
  document.getElementById('movInvNombre').textContent = nombre;
  document.getElementById('movInvCantidad').value = '';
  document.getElementById('movInvNota').value = '';
  abrirModal('modalInvMovimiento');
}

export async function guardarMovimientoInv() {
  const id = document.getElementById('movInvItemId').value;
  const cantidad = parseFloat(document.getElementById('movInvCantidad').value);
  if (!cantidad || cantidad <= 0) { toast('Ingresa una cantidad valida'); return; }
  const tipo = document.getElementById('movInvTipo').value;
  const nota = document.getElementById('movInvNota').value.trim();
  try {
    await api('POST', `/inventario/${id}/movimientos`, { cantidad, tipo, nota });
    toast('Stock actualizado');
    cerrarModal('modalInvMovimiento');
    cargarInventario();
  } catch (e) { toast('Error: ' + e.message); }
}
