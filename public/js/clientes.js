import { state } from './state.js';
import { api } from './api.js';
import { toast, fmtCurrency, fmtDate, abrirModal, cerrarModal } from './ui.js';

export async function cargarClientes() {
  const q = document.getElementById('buscarCliente').value.trim();
  try {
    const url = q ? '/clientes?q=' + encodeURIComponent(q) : '/clientes';
    const clientes = await api('GET', url);
    renderClientes(clientes);
  } catch (e) { toast('Error al cargar clientes'); }
}

function renderClientes(clientes) {
  const el = document.getElementById('clientesList');
  if (clientes.length === 0) {
    el.innerHTML = '<div class="empty-state">No hay clientes registrados</div>';
    return;
  }
  let html = '';
  clientes.forEach(c => {
    html += `<div class="client-card" onclick="window.verCliente('${c.id}')">
      <div class="cl-info">
        <span class="cl-name">${c.nombre || 'Sin nombre'}</span>
        ${c.telefono ? `<span class="cl-tel">📞 ${c.telefono}</span>` : ''}
        <div class="cc-meta">${c.total_ventas || 0} compras</div>
      </div>
      <div class="cc-right">${c.notas ? 'Notas' : ''}</div>
    </div>`;
  });
  el.innerHTML = html;
}

export function mostrarModalCliente() {
  state.clienteEditId = null;
  document.getElementById('modalClienteTitle').textContent = 'Nuevo Cliente';
  document.getElementById('clienteEditId').value = '';
  document.getElementById('clienteNombre').value = '';
  document.getElementById('clienteTelefono').value = '';
  document.getElementById('clienteNotas').value = '';
  abrirModal('modalClienteForm');
}

export function editarCliente(id, nombre, telefono, notas) {
  state.clienteEditId = id;
  document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
  document.getElementById('clienteEditId').value = id;
  document.getElementById('clienteNombre').value = nombre;
  document.getElementById('clienteTelefono').value = telefono || '';
  document.getElementById('clienteNotas').value = notas || '';
  abrirModal('modalClienteForm');
}

export async function guardarCliente() {
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
  } catch (e) { toast('Error: ' + e.message); }
}

export async function verCliente(id) {
  state.clienteActualId = id;
  try {
    const [cliente, ventas] = await Promise.all([
      api('GET', '/clientes?q=' + id).then(clientes => clientes.find(c => c.id === id)),
      api('GET', '/clientes/' + id + '/ventas'),
    ]);
    if (!cliente) { toast('Cliente no encontrado'); return; }
    document.getElementById('detalleClienteNombre').textContent = 'Cliente: ' + cliente.nombre;
    document.getElementById('detalleClienteInfo').innerHTML = `
      ${cliente.telefono ? '<p style="font-size:0.85rem;color:var(--text-light)">Tel: ' + cliente.telefono + '</p>' : ''}
      ${cliente.notas ? '<p style="font-size:0.8rem;color:var(--text-light);margin-top:4px;">Notas: ' + cliente.notas + '</p>' : ''}
      <p style="font-size:0.85rem;margin-top:8px;"><strong>Total compras:</strong> ${ventas.length} - <strong>Total:</strong> $${fmtCurrency(ventas.reduce((s, v) => s + v.precio_usd, 0))}</p>
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
  } catch (e) { toast('Error al cargar cliente'); }
}

export async function eliminarClienteActual() {
  if (!state.clienteActualId) return;
  if (!confirm('Eliminar este cliente?')) return;
  try {
    await api('DELETE', '/clientes/' + state.clienteActualId);
    toast('Cliente eliminado');
    cerrarModal('modalClienteDetalle');
    cargarClientes();
  } catch (e) { toast('Error'); }
}
