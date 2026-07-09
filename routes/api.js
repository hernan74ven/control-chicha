const express = require('express');
const router = express.Router();
const { getFirestore } = require('../firebase/config');

function jsonOk(res, data) {
  res.json({ ok: true, data });
}
function jsonError(res, msg, status = 400) {
  res.status(status).json({ ok: false, error: msg });
}

// Utility to get Firestore
const db = () => getFirestore();

// ---- CONFIG ----
router.get('/config', async (req, res) => {
  try {
    const snapshot = await db().collection('config').get();
    const cfg = {};
    snapshot.forEach(doc => {
      cfg[doc.id] = doc.data().value;
    });
    jsonOk(res, cfg);
  } catch (e) {
    jsonError(res, 'Error al leer configuración', 500);
  }
});

router.put('/config', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return jsonError(res, 'Falta key');
    await db().collection('config').doc(key).set({ key, value: String(value) }, { merge: true });
    jsonOk(res, { key, value: String(value) });
  } catch (e) {
    jsonError(res, 'Error al guardar configuración', 500);
  }
});

// ---- TAMAÑOS ----
router.get('/tamanos', async (req, res) => {
  try {
    const snapshot = await db().collection('tamanos').get();
    const result = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.activo === 1) result.push({ id: doc.id, ...d });
    });
    result.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    jsonOk(res, result);
  } catch (e) {
    console.error(e);
    jsonError(res, 'Error al leer tamaños', 500);
  }
});

router.post('/tamanos', async (req, res) => {
  try {
    const { nombre, precio_usd } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    
    const snap = await db().collection('tamanos').orderBy('orden', 'desc').limit(1).get();
    let maxOrd = 0;
    if (!snap.empty) {
      maxOrd = snap.docs[0].data().orden || 0;
    }
    
    const docRef = db().collection('tamanos').doc();
    const data = { nombre, precio_usd: precio_usd || 0, orden: maxOrd + 1, activo: 1 };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear tamaño', 500);
  }
});

router.put('/tamanos/:id', async (req, res) => {
  try {
    const { nombre, precio_usd, orden, activo, rendimiento, onzaxvaso } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (precio_usd !== undefined) update.precio_usd = precio_usd;
    if (orden !== undefined) update.orden = orden;
    if (activo !== undefined) update.activo = activo ? 1 : 0;
    if (rendimiento !== undefined) update.rendimiento = rendimiento;
    if (onzaxvaso !== undefined) update.onzaxvaso = onzaxvaso;
    
    if (Object.keys(update).length === 0) return jsonError(res, 'Nada que actualizar');
    await db().collection('tamanos').doc(req.params.id).update(update);
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar tamaño', 500);
  }
});

router.delete('/tamanos/:id', async (req, res) => {
  try {
    await db().collection('tamanos').doc(req.params.id).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar tamaño', 500);
  }
});

router.put('/receta/tamano/:id', async (req, res) => {
  try {
    const { rendimiento, onzaxvaso } = req.body;
    const update = {};
    if (rendimiento !== undefined) update.rendimiento = rendimiento;
    if (onzaxvaso !== undefined) update.onzaxvaso = onzaxvaso;
    
    if (Object.keys(update).length > 0) {
      await db().collection('tamanos').doc(req.params.id).update(update);
    }
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar tamaño', 500);
  }
});

// ---- OTROS PRODUCTOS ----
router.get('/otros-productos', async (req, res) => {
  try {
    const snapshot = await db().collection('otros_productos').get();
    const result = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.activo === 1) result.push({ id: doc.id, ...d });
    });
    result.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer productos', 500);
  }
});

router.post('/otros-productos', async (req, res) => {
  try {
    const { nombre, precio_usd } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    
    const snap = await db().collection('otros_productos').orderBy('orden', 'desc').limit(1).get();
    let maxOrd = 0;
    if (!snap.empty) {
      maxOrd = snap.docs[0].data().orden || 0;
    }
    
    const docRef = db().collection('otros_productos').doc();
    const data = { nombre, precio_usd: precio_usd || 0, orden: maxOrd + 1, activo: 1 };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear producto', 500);
  }
});

router.put('/otros-productos/:id', async (req, res) => {
  try {
    const { nombre, precio_usd, orden, activo } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (precio_usd !== undefined) update.precio_usd = precio_usd;
    if (orden !== undefined) update.orden = orden;
    if (activo !== undefined) update.activo = activo ? 1 : 0;
    
    if (Object.keys(update).length === 0) return jsonError(res, 'Nada que actualizar');
    await db().collection('otros_productos').doc(req.params.id).update(update);
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar producto', 500);
  }
});

router.delete('/otros-productos/:id', async (req, res) => {
  try {
    await db().collection('otros_productos').doc(req.params.id).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar producto', 500);
  }
});

// ---- VENDEDORES ----
router.get('/vendedores', async (req, res) => {
  try {
    const snapshot = await db().collection('vendedores').get();
    const result = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.activo === 1) result.push({ id: doc.id, ...d });
    });
    result.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer vendedores', 500);
  }
});

router.post('/vendedores', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    const docRef = db().collection('vendedores').doc();
    const data = { nombre, activo: 1, creado_en: new Date().toISOString() };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear vendedor', 500);
  }
});

router.put('/vendedores/:id', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (activo !== undefined) update.activo = activo ? 1 : 0;
    
    if (Object.keys(update).length > 0) {
      await db().collection('vendedores').doc(req.params.id).update(update);
    }
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar vendedor', 500);
  }
});

router.delete('/vendedores/:id', async (req, res) => {
  try {
    await db().collection('vendedores').doc(req.params.id).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar vendedor', 500);
  }
});

// ---- CLIENTES ----
router.get('/clientes', async (req, res) => {
  try {
    const q = req.query.q;
    const snapshot = await db().collection('clientes').orderBy('nombre').get();
    let result = [];
    snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    
    if (q) {
      const query = q.toLowerCase();
      result = result.filter(c => c.nombre.toLowerCase().includes(query) || (c.telefono && c.telefono.includes(query)));
    }
    
    const ventasSnap = await db().collection('ventas').get();
    const ventasCount = {};
    ventasSnap.forEach(doc => {
      const data = doc.data();
      if (data.cliente_id) {
        ventasCount[data.cliente_id] = (ventasCount[data.cliente_id] || 0) + 1;
      }
    });
    
    result = result.map(c => ({ ...c, total_ventas: ventasCount[c.id] || 0 }));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer clientes', 500);
  }
});

router.post('/clientes', async (req, res) => {
  try {
    const { nombre, telefono, notas } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    const docRef = db().collection('clientes').doc();
    const data = { nombre, telefono: telefono || '', notas: notas || '', creado_en: new Date().toISOString() };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear cliente', 500);
  }
});

router.put('/clientes/:id', async (req, res) => {
  try {
    const { nombre, telefono, notas } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (telefono !== undefined) update.telefono = telefono;
    if (notas !== undefined) update.notas = notas;
    
    if (Object.keys(update).length === 0) return jsonError(res, 'Nada que actualizar');
    await db().collection('clientes').doc(req.params.id).update(update);
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar cliente', 500);
  }
});

router.delete('/clientes/:id', async (req, res) => {
  try {
    const batch = db().batch();
    const ventasSnap = await db().collection('ventas').where('cliente_id', '==', req.params.id).get();
    ventasSnap.forEach(doc => {
      batch.update(doc.ref, { cliente_id: null });
    });
    batch.delete(db().collection('clientes').doc(req.params.id));
    await batch.commit();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar cliente', 500);
  }
});

router.get('/clientes/:id/ventas', async (req, res) => {
  try {
    const snapshot = await db().collection('ventas').get();
    const result = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (String(data.cliente_id) === String(req.params.id)) {
        result.push({ id: doc.id, ...data });
      }
    });
    result.sort((a, b) => (b.creado_en || '').localeCompare(a.creado_en || ''));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer ventas del cliente', 500);
  }
});

// ---- VENTAS ----
router.get('/ventas', async (req, res) => {
  try {
    const { desde, hasta, vendedor_id } = req.query;
    
    const snapshot = await db().collection('ventas').get();
    const vendedoresSnap = await db().collection('vendedores').get();
    const clientesSnap = await db().collection('clientes').get();
    
    const vendedores = {};
    vendedoresSnap.forEach(d => vendedores[d.id] = d.data().nombre);
    const clientes = {};
    clientesSnap.forEach(d => clientes[d.id] = d.data().nombre);
    
    const result = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      if (vendedor_id && String(data.vendedor_id) !== String(vendedor_id)) return;
      const fechaVenta = (data.creado_en || '').slice(0, 10);
      if (desde && fechaVenta < desde) return;
      if (hasta && fechaVenta > hasta) return;

      result.push({
        id: doc.id,
        ...data,
        vendedor_nombre: data.vendedor_id ? vendedores[String(data.vendedor_id)] : null,
        cliente_nombre: data.cliente_id ? clientes[String(data.cliente_id)] : null
      });
    });
    
    result.sort((a, b) => (b.creado_en || '').localeCompare(a.creado_en || ''));
    jsonOk(res, result);
  } catch (e) {
    console.error(e);
    jsonError(res, 'Error al leer ventas', 500);
  }
});

router.post('/ventas', async (req, res) => {
  try {
    const configSnap = await db().collection('config').doc('tasa_dolar').get();
    const tasa = configSnap.exists ? parseFloat(configSnap.data().value) || 0 : 0;
    
    const mon = req.body.moneda || 'USD';
      const mp = req.body.metodo_pago || 'efectivo';
      const lugar = req.body.lugar || '';
      const vendedorId = req.body.vendedor_id ? String(req.body.vendedor_id) : null;
      const clienteId = req.body.cliente_id ? String(req.body.cliente_id) : null;
      const efectivoBs = req.body.efectivo_bs ? parseFloat(req.body.efectivo_bs) : null;
      const pagomovilBs = req.body.pagomovil_bs ? parseFloat(req.body.pagomovil_bs) : null;
      
      const batch = db().batch();
      const createdVentas = [];

      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        for (const item of req.body.items) {
          if (!item.tipo_producto || !item.producto_nombre || item.precio_usd === undefined) continue;
          const precioVes = item.precio_usd * tasa;
          const cant = item.cantidad || 1;
          for (let i = 0; i < cant; i++) {
            const docRef = db().collection('ventas').doc();
            const ventaData = {
              tipo_producto: item.tipo_producto,
              producto_id: item.producto_id ? String(item.producto_id) : null,
              producto_nombre: item.producto_nombre,
              precio_usd: item.precio_usd,
              precio_ves: precioVes,
              tasa_dia: tasa,
              moneda: mon,
              metodo_pago: mp,
              lugar: lugar,
              vendedor_id: vendedorId,
              cliente_id: clienteId,
              creado_en: new Date().toISOString()
            };
            if (mp === 'mixto' && efectivoBs !== null && pagomovilBs !== null) {
              ventaData.efectivo_bs = efectivoBs / cant;
              ventaData.pagomovil_bs = pagomovilBs / cant;
            }
            batch.set(docRef, ventaData);
            createdVentas.push({ id: docRef.id, ...ventaData });
          }
        }
      } else {
        const { tipo_producto, producto_id, producto_nombre, precio_usd } = req.body;
        if (!tipo_producto || !producto_nombre || precio_usd === undefined) {
          return jsonError(res, 'Faltan datos requeridos (tipo_producto, producto_nombre, precio_usd)');
        }
        const precioVes = precio_usd * tasa;
        
        const docRef = db().collection('ventas').doc();
        const ventaData = {
          tipo_producto,
          producto_id: producto_id ? String(producto_id) : null,
          producto_nombre,
          precio_usd,
          precio_ves: precioVes,
          tasa_dia: tasa,
          moneda: mon,
          metodo_pago: mp,
          lugar: lugar,
          vendedor_id: vendedorId,
          cliente_id: clienteId,
          creado_en: new Date().toISOString()
        };
        if (mp === 'mixto' && efectivoBs !== null && pagomovilBs !== null) {
          ventaData.efectivo_bs = efectivoBs;
          ventaData.pagomovil_bs = pagomovilBs;
        }
        batch.set(docRef, ventaData);
        createdVentas.push({ id: docRef.id, ...ventaData });
      }
    
    await batch.commit();

    if (createdVentas.length > 0) {
      const v = createdVentas[0];
      if (v.vendedor_id) {
        const vSnap = await db().collection('vendedores').doc(v.vendedor_id).get();
        if (vSnap.exists) v.vendedor_nombre = vSnap.data().nombre;
      }
      if (v.cliente_id) {
        const cSnap = await db().collection('clientes').doc(v.cliente_id).get();
        if (cSnap.exists) v.cliente_nombre = cSnap.data().nombre;
      }
      return jsonOk(res, v);
    } else {
      return jsonError(res, 'No se procesaron ventas');
    }
  } catch (e) {
    console.error(e);
    jsonError(res, 'Error al crear venta', 500);
  }
});

router.delete('/ventas', async (req, res) => {
  try {
    const snapshot = await db().collection('ventas').get();
    const batch = db().batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    jsonOk(res, { deleted: snapshot.size });
  } catch (e) {
    jsonError(res, 'Error al eliminar ventas', 500);
  }
});

router.delete('/ventas/:id', async (req, res) => {
  try {
    await db().collection('ventas').doc(req.params.id).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar venta', 500);
  }
});

// ---- REPORTES ----
router.get('/reportes/resumen', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const d1 = desde || new Date().toISOString().slice(0,10);
    const d2 = hasta || d1;

    const snapshot = await db().collection('ventas').get();
    
    const totales = { total_ventas: 0, total_usd: 0, total_ves: 0 };
    const productosMap = {};
    const vendedoresMap = {};
    const diasMap = {};
    const pagosMap = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const fechaVenta = (data.creado_en || '').slice(0, 10);
      if (fechaVenta < d1 || fechaVenta > d2) return;
      
      totales.total_ventas++;
      totales.total_usd += (data.precio_usd || 0);
      totales.total_ves += (data.precio_ves || 0);
      
      if (!productosMap[data.producto_nombre]) productosMap[data.producto_nombre] = { cantidad: 0, total: 0 };
      productosMap[data.producto_nombre].cantidad++;
      productosMap[data.producto_nombre].total += (data.precio_usd || 0);
      
      const vId = data.vendedor_id || 'Sin Vendedor';
      if (!vendedoresMap[vId]) vendedoresMap[vId] = { cantidad: 0, total: 0 };
      vendedoresMap[vId].cantidad++;
      vendedoresMap[vId].total += (data.precio_usd || 0);
      
      const dia = data.creado_en ? data.creado_en.slice(0, 10) : 'Desconocido';
      if (!diasMap[dia]) diasMap[dia] = { cantidad: 0, total: 0 };
      diasMap[dia].cantidad++;
      diasMap[dia].total += (data.precio_usd || 0);
      
      if (data.metodo_pago === 'mixto' && data.moneda === 'VES') {
        const ef = data.efectivo_bs || 0;
        const pm = data.pagomovil_bs || 0;
        const total = ef + pm || 1;
        const keyEf = 'VES-efectivo';
        if (!pagosMap[keyEf]) pagosMap[keyEf] = { moneda: 'VES', metodo_pago: 'efectivo', cantidad: 0, total_usd: 0, total_ves: 0 };
        pagosMap[keyEf].cantidad++;
        pagosMap[keyEf].total_usd += (data.precio_usd || 0) * (ef / total);
        pagosMap[keyEf].total_ves += ef;
        const keyPm = 'VES-pago_movil';
        if (!pagosMap[keyPm]) pagosMap[keyPm] = { moneda: 'VES', metodo_pago: 'pago_movil', cantidad: 0, total_usd: 0, total_ves: 0 };
        pagosMap[keyPm].cantidad++;
        pagosMap[keyPm].total_usd += (data.precio_usd || 0) * (pm / total);
        pagosMap[keyPm].total_ves += pm;
      } else {
        const key = `${data.moneda || 'USD'}-${data.metodo_pago || 'efectivo'}`;
        if (!pagosMap[key]) pagosMap[key] = { moneda: data.moneda, metodo_pago: data.metodo_pago, cantidad: 0, total_usd: 0, total_ves: 0 };
        pagosMap[key].cantidad++;
        pagosMap[key].total_usd += (data.precio_usd || 0);
        pagosMap[key].total_ves += (data.precio_ves || 0);
      }
    });
    
    const masVendido = Object.keys(productosMap)
      .map(k => ({ producto_nombre: k, ...productosMap[k] }))
      .sort((a,b) => b.cantidad - a.cantidad)
      .slice(0, 5);
      
    const porVendedor = [];
    for (const vId of Object.keys(vendedoresMap)) {
      let nombre = 'Sin Vendedor';
      if (vId !== 'Sin Vendedor') {
        const vSnap = await db().collection('vendedores').doc(vId).get();
        if (vSnap.exists) nombre = vSnap.data().nombre;
      }
      porVendedor.push({ nombre, ...vendedoresMap[vId] });
    }
    porVendedor.sort((a,b) => b.total - a.total);
    
    const ventasPorDia = Object.keys(diasMap)
      .map(k => ({ dia: k, ...diasMap[k] }))
      .sort((a,b) => a.dia.localeCompare(b.dia));
      
    const pagoDesglose = Object.values(pagosMap).sort((a,b) => a.moneda.localeCompare(b.moneda));
    
    jsonOk(res, { totales, masVendido, porVendedor, ventasPorDia, pagoDesglose });
  } catch (e) {
    console.error(e);
    jsonError(res, 'Error al generar reporte', 500);
  }
});

// ---- INVENTARIO ----
router.get('/inventario', async (req, res) => {
  try {
    const snapshot = await db().collection('inventario').orderBy('nombre').get();
    const result = [];
    snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer inventario', 500);
  }
});

router.post('/inventario', async (req, res) => {
  try {
    const { nombre, unidad, stock, stock_minimo } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    const docRef = db().collection('inventario').doc();
    const data = { nombre, unidad: unidad || 'unidad', stock: stock || 0, stock_minimo: stock_minimo || 0, creado_en: new Date().toISOString() };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear item', 500);
  }
});

router.put('/inventario/:id', async (req, res) => {
  try {
    const { nombre, unidad, stock, stock_minimo } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (unidad !== undefined) update.unidad = unidad;
    if (stock !== undefined) update.stock = stock;
    if (stock_minimo !== undefined) update.stock_minimo = stock_minimo;
    
    if (Object.keys(update).length === 0) return jsonError(res, 'Nada que actualizar');
    await db().collection('inventario').doc(req.params.id).update(update);
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar item', 500);
  }
});

router.delete('/inventario/:id', async (req, res) => {
  try {
    const batch = db().batch();
    const movsSnap = await db().collection('inventario_movimientos').where('item_id', '==', req.params.id).get();
    movsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(db().collection('inventario').doc(req.params.id));
    await batch.commit();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar item', 500);
  }
});

router.get('/inventario/:id/movimientos', async (req, res) => {
  try {
    const snapshot = await db().collection('inventario_movimientos').where('item_id', '==', req.params.id).orderBy('creado_en', 'desc').get();
    const result = [];
    snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer movimientos', 500);
  }
});

router.post('/inventario/:id/movimientos', async (req, res) => {
  try {
    const { cantidad, tipo, nota } = req.body;
    if (!cantidad || !tipo) return jsonError(res, 'Faltan datos');
    
    const itemRef = db().collection('inventario').doc(req.params.id);
    const itemSnap = await itemRef.get();
    
    if (!itemSnap.exists) return jsonError(res, 'Item no encontrado', 404);
    
    const qty = tipo === 'out' ? -Math.abs(cantidad) : Math.abs(cantidad);
    const currentStock = itemSnap.data().stock || 0;
    const newStock = currentStock + qty;
    
    const movRef = db().collection('inventario_movimientos').doc();
    const movData = {
      item_id: req.params.id,
      cantidad: Math.abs(cantidad),
      tipo,
      nota: nota || '',
      creado_en: new Date().toISOString()
    };
    
    const batch = db().batch();
    batch.set(movRef, movData);
    batch.update(itemRef, { stock: newStock });
    await batch.commit();
    
    const updated = await itemRef.get();
    jsonOk(res, { id: updated.id, ...updated.data() });
  } catch (e) {
    jsonError(res, 'Error al registrar movimiento', 500);
  }
});

// ---- RECETA (costos) ----
router.get('/receta/ingredientes', async (req, res) => {
  try {
    const snapshot = await db().collection('receta_ingredientes').orderBy('created_at').get();
    const result = [];
    snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer ingredientes', 500);
  }
});

router.post('/receta/ingredientes', async (req, res) => {
  try {
    const { nombre, cantidad, unidad, precio_unitario } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    const docRef = db().collection('receta_ingredientes').doc();
    const data = {
      nombre, 
      cantidad: cantidad || 0, 
      unidad: unidad || 'kg', 
      precio_unitario: precio_unitario || 0,
      created_at: new Date().toISOString()
    };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear ingrediente', 500);
  }
});

router.put('/receta/ingredientes/:id', async (req, res) => {
  try {
    const { nombre, cantidad, unidad, precio_unitario } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (cantidad !== undefined) update.cantidad = cantidad;
    if (unidad !== undefined) update.unidad = unidad;
    if (precio_unitario !== undefined) update.precio_unitario = precio_unitario;
    
    if (Object.keys(update).length === 0) return jsonError(res, 'Nada que actualizar');
    await db().collection('receta_ingredientes').doc(req.params.id).update(update);
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar ingrediente', 500);
  }
});

router.delete('/receta/ingredientes/:id', async (req, res) => {
  try {
    await db().collection('receta_ingredientes').doc(req.params.id).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar ingrediente', 500);
  }
});

// ---- BACKUP (exportar datos a JSON) ----
router.post('/backup', async (req, res) => {
  try {
    const collections = ['config', 'tamanos', 'otros_productos', 'vendedores', 'clientes', 'ventas', 'inventario', 'inventario_movimientos', 'receta_ingredientes', 'puntos'];
    const backup = {};
    for (const name of collections) {
      const snap = await db().collection(name).get();
      backup[name] = [];
      snap.forEach(doc => backup[name].push({ id: doc.id, ...doc.data() }));
    }
    jsonOk(res, { backup, creado_en: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    jsonError(res, 'Error al crear backup', 500);
  }
});

// ---- DIAS (registro de cierre de día) ----
router.post('/dias/cerrar', async (req, res) => {
  try {
    const { fecha, punto, ventas_count, total_usd, total_ves, usd_efectivo, chicha_onzas, chicha_ventas } = req.body;
    if (!fecha) return jsonError(res, 'Fecha requerida');
    const docId = fecha + (punto ? '_' + punto : '');
    await db().collection('dias').doc(docId).set({
      fecha,
      punto: punto || '',
      estado: 'cerrado',
      ventas_count: ventas_count || 0,
      total_usd: total_usd || 0,
      total_ves: total_ves || 0,
      usd_efectivo: usd_efectivo || 0,
      chicha_onzas: chicha_onzas || 0,
      chicha_ventas: chicha_ventas || 0,
      cerrado_en: new Date().toISOString()
    });
    jsonOk(res, { ok: true });
  } catch (e) {
    jsonError(res, 'Error al cerrar día', 500);
  }
});

router.delete('/dias/:fecha', async (req, res) => {
  try {
    await db().collection('dias').doc(req.params.fecha).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar día', 500);
  }
});

router.get('/dias', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const snapshot = await db().collection('dias').get();
    const result = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const f = data.fecha || doc.id.slice(0, 10);
      if (desde && f < desde) return;
      if (hasta && f > hasta) return;
      result.push({ id: doc.id, ...data });
    });
    result.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer días', 500);
  }
});

// ---- PUNTOS DE VENTA ----
router.get('/puntos', async (req, res) => {
  try {
    const snapshot = await db().collection('puntos').get();
    const result = [];
    snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    jsonOk(res, result);
  } catch (e) {
    jsonError(res, 'Error al leer puntos', 500);
  }
});

router.post('/puntos', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return jsonError(res, 'Falta nombre');
    const docRef = db().collection('puntos').doc();
    const data = { nombre, activo: 1, creado_en: new Date().toISOString() };
    await docRef.set(data);
    jsonOk(res, { id: docRef.id, ...data });
  } catch (e) {
    jsonError(res, 'Error al crear punto', 500);
  }
});

router.put('/puntos/:id', async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const update = {};
    if (nombre !== undefined) update.nombre = nombre;
    if (activo !== undefined) update.activo = activo ? 1 : 0;
    if (Object.keys(update).length > 0) await db().collection('puntos').doc(req.params.id).update(update);
    jsonOk(res, { updated: true });
  } catch (e) {
    jsonError(res, 'Error al actualizar punto', 500);
  }
});

router.delete('/puntos/:id', async (req, res) => {
  try {
    await db().collection('puntos').doc(req.params.id).delete();
    jsonOk(res, { deleted: true });
  } catch (e) {
    jsonError(res, 'Error al eliminar punto', 500);
  }
});

// ---- MOCK SYNC ENDPOINTS ----
router.get('/sync/status', (req, res) => {
  jsonOk(res, { enabled: true, syncing: false, lastSync: new Date().toISOString() });
});
router.post('/sync/push', (req, res) => jsonOk(res, { enabled: true }));
router.post('/sync/pull', (req, res) => jsonOk(res, { enabled: true }));

module.exports = router;
