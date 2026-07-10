import { state } from './state.js';
import { api } from './api.js';
import { toast, abrirModal, cerrarModal } from './ui.js';
import { trackAppOpen } from './analytics.js';
import {
  renderHeader, renderVender, renderChichaStatus,
  mostrarInicioDia, comenzarDia, cerrarDia,
  guardarVendedorActivo, getVendedorActivo,
  seleccionarMoneda, seleccionarMetodoPago, actualizarMixtoPagoMovil,
  toggleModoVarias,
  agregarAlCarrito, carritoSumar, carritoRestar, carritoEliminar, abrirCarrito,
  iniciarVenta, confirmarVentaUnidad, inicializarChichaVendido, sincronizarChichaVendido,
  confirmarVentaCarrito,
  iniciarLoteChicha, reabastecerChicha,
  _iniciarReapertura, _cancelarReapertura,
  cambiarPunto,
} from './ventas.js';
import { cargarHistorial, eliminarVenta } from './historial.js';
import { cargarReportes } from './reportes.js';
import { switchSubTab } from './receta.js';
import {
  cargarInventario as cargarInventarioItems,
  mostrarModalInventario, editarInventario, guardarInventario, eliminarInventario,
  mostrarModalMovimiento, guardarMovimientoInv,
} from './inventario.js';
import {
  cargarReceta, mostrarModalIngrediente, editarPrecioIngrediente,
  guardarIngrediente, eliminarIngrediente,
  actualizarOnzas, guardarBatchSize, guardarTotalOnzas,
} from './receta.js';
import {
  cargarClientes, mostrarModalCliente, editarCliente,
  guardarCliente, verCliente, eliminarClienteActual,
} from './clientes.js';
import {
  renderConfig, guardarTasa,
  agregarTamano, actualizarTamano, eliminarTamano,
  agregarOtroProducto, actualizarOtroProducto, eliminarOtroProducto,
  agregarVendedor, actualizarVendedor, eliminarVendedor,
  agregarPunto, actualizarPunto, eliminarPunto,
} from './config.js';

// ---- Tab navigation ----
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-tab="${tab}"]`).classList.add('active');

  switch (tab) {
    case 'vender': renderVender(); break;
    case 'historial': cargarHistorial(); break;
    case 'reportes': cargarReportes(); break;
    case 'inventario':
      document.querySelectorAll('#tabInventario .sub-tab').forEach(el => el.classList.remove('active'));
      document.querySelector('#tabInventario .sub-tab[data-subtab="items"]').classList.add('active');
      document.querySelectorAll('#tabInventario .subtab-content').forEach(el => el.classList.remove('active'));
      document.getElementById('subtabItems').classList.add('active');
      cargarInventarioItems();
      break;
    case 'clientes': cargarClientes(); break;
    case 'config': renderConfig(); break;
  }
}

// ---- Render all ----
async function renderAll() {
  await renderHeader();
  renderVender();
}

// ---- Init ----
async function init() {
  try {
    const [config, tamanos, otrosProductos, vendedores, puntos] = await Promise.all([
      api('GET', '/config'),
      api('GET', '/tamanos'),
      api('GET', '/otros-productos'),
      api('GET', '/vendedores'),
      api('GET', '/puntos'),
    ]);
    state.config = config;
    state.tamanos = tamanos;
    state.otrosProductos = otrosProductos;
    state.vendedores = vendedores;
    state.puntos = puntos;
  } catch (e) {
    console.error('Error al cargar datos:', e);
    toast('Error al conectar con el servidor');
  }
  await inicializarChichaVendido();
  renderAll();
  trackAppOpen();
  setTimeout(() => {
    const tasa = parseFloat(state.config.tasa_dolar || '0');
    const onzas = parseFloat(state.config.chicha_inicial_onzas || '0');
    const punto = state.config.punto_actual || state.config.lugar_actual || '';
    if (tasa <= 0 || onzas <= 0 || !punto) {
      mostrarInicioDia();
    }
  }, 500);
}

// Sync chicha counter across devices every 5 minutes
setInterval(() => sincronizarChichaVendido(), 300000);

// ---- Wire up tab buttons ----
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => { if (btn.dataset.tab) switchTab(btn.dataset.tab); });
});

// ---- Wire up modal overlay clicks ----
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el) el.classList.add('hidden');
  });
});

// ---- Export everything to window for inline onclick handlers ----
window.renderAll = renderAll;
window.switchTab = switchTab;
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;
window.toast = toast;

window.mostrarInicioDia = mostrarInicioDia;
window.comenzarDia = comenzarDia;
window.cerrarDia = cerrarDia;
window.guardarVendedorActivo = guardarVendedorActivo;
window.seleccionarMoneda = seleccionarMoneda;
window.seleccionarMetodoPago = seleccionarMetodoPago;
window.actualizarMixtoPagoMovil = actualizarMixtoPagoMovil;
window.toggleModoVarias = toggleModoVarias;
window.agregarAlCarrito = agregarAlCarrito;
window.carritoSumar = carritoSumar;
window.carritoRestar = carritoRestar;
window.carritoEliminar = carritoEliminar;
window.abrirCarrito = abrirCarrito;
window.iniciarVenta = iniciarVenta;
window.confirmarVentaUnidad = confirmarVentaUnidad;
window.confirmarVentaCarrito = confirmarVentaCarrito;
window.iniciarLoteChicha = iniciarLoteChicha;
window.reabastecerChicha = reabastecerChicha;
window._iniciarReapertura = _iniciarReapertura;
window._cancelarReapertura = _cancelarReapertura;
window.cambiarPunto = cambiarPunto;

window.cargarHistorial = cargarHistorial;
window.eliminarVenta = eliminarVenta;

window.cargarReportes = cargarReportes;

window.switchSubTab = switchSubTab;
window.cargarInventario = cargarInventarioItems;
window.mostrarModalInventario = mostrarModalInventario;
window.editarInventario = editarInventario;
window.guardarInventario = guardarInventario;
window.eliminarInventario = eliminarInventario;
window.mostrarModalMovimiento = mostrarModalMovimiento;
window.guardarMovimientoInv = guardarMovimientoInv;

window.cargarReceta = cargarReceta;
window.mostrarModalIngrediente = mostrarModalIngrediente;
window.editarPrecioIngrediente = editarPrecioIngrediente;
window.guardarIngrediente = guardarIngrediente;
window.eliminarIngrediente = eliminarIngrediente;
window.actualizarOnzas = actualizarOnzas;
window.guardarBatchSize = guardarBatchSize;
window.guardarTotalOnzas = guardarTotalOnzas;

window.cargarClientes = cargarClientes;
window.mostrarModalCliente = mostrarModalCliente;
window.editarCliente = editarCliente;
window.guardarCliente = guardarCliente;
window.verCliente = verCliente;
window.eliminarClienteActual = eliminarClienteActual;

window.renderConfig = renderConfig;
window.guardarTasa = guardarTasa;
window.agregarTamano = agregarTamano;
window.actualizarTamano = actualizarTamano;
window.eliminarTamano = eliminarTamano;
window.agregarOtroProducto = agregarOtroProducto;
window.actualizarOtroProducto = actualizarOtroProducto;
window.eliminarOtroProducto = eliminarOtroProducto;
window.agregarVendedor = agregarVendedor;
window.actualizarVendedor = actualizarVendedor;
window.eliminarVendedor = eliminarVendedor;
window.agregarPunto = agregarPunto;
window.actualizarPunto = actualizarPunto;
window.eliminarPunto = eliminarPunto;

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
