const { getFirestore } = require('./config');

async function seedDefaults() {
  const db = getFirestore();
  if (!db) return;

  try {
    // Check config
    const configSnap = await db.collection('config').limit(1).get();
    if (configSnap.empty) {
      console.log('[Seed] Seeding config...');
      const batch = db.batch();
      batch.set(db.collection('config').doc('tasa_dolar'), { value: '0' });
      batch.set(db.collection('config').doc('moneda_local'), { value: 'Bs' });
      batch.set(db.collection('config').doc('receta_batch_size'), { value: '10' });
      batch.set(db.collection('config').doc('receta_batch_unidad'), { value: 'kg' });
      batch.set(db.collection('config').doc('receta_total_onzas'), { value: '720' });
      batch.set(db.collection('config').doc('chicha_inicial_onzas'), { value: '0' });
      await batch.commit();
    }

    // Check tamanos
    const tamSnap = await db.collection('tamanos').limit(1).get();
    if (tamSnap.empty) {
      console.log('[Seed] Seeding tamanos...');
      const batch = db.batch();
      const t1 = db.collection('tamanos').doc();
      batch.set(t1, { nombre: 'Pequeño', precio_usd: 1.00, orden: 1, activo: 1, rendimiento: 8, onzaxvaso: 8 });
      const t2 = db.collection('tamanos').doc();
      batch.set(t2, { nombre: 'Mediano', precio_usd: 2.00, orden: 2, activo: 1, rendimiento: 12, onzaxvaso: 12 });
      const t3 = db.collection('tamanos').doc();
      batch.set(t3, { nombre: 'Grande', precio_usd: 3.00, orden: 3, activo: 1, rendimiento: 16, onzaxvaso: 16 });
      const t4 = db.collection('tamanos').doc();
      batch.set(t4, { nombre: 'Extra Grande', precio_usd: 4.00, orden: 4, activo: 1, rendimiento: 24, onzaxvaso: 24 });
      await batch.commit();
    }

    // Check vendedores
    const vendSnap = await db.collection('vendedores').limit(1).get();
    if (vendSnap.empty) {
      console.log('[Seed] Seeding vendedores...');
      await db.collection('vendedores').add({ nombre: 'Principal', activo: 1, creado_en: new Date().toISOString() });
    }

    // Check ingredientes
    const ingSnap = await db.collection('receta_ingredientes').limit(1).get();
    if (ingSnap.empty) {
      console.log('[Seed] Seeding receta_ingredientes...');
      const data = [
        { nombre: 'Leche en polvo', cantidad: 1, unidad: 'kg', precio_unitario: 11 },
        { nombre: 'Azúcar', cantidad: 3, unidad: 'kg', precio_unitario: 2 },
        { nombre: 'Leche condensada', cantidad: 3, unidad: 'unidad', precio_unitario: 2 },
        { nombre: 'Especias', cantidad: 200, unidad: 'gr', precio_unitario: 0.05 },
        { nombre: 'Hielo grande', cantidad: 5, unidad: 'kg', precio_unitario: 0.6 },
        { nombre: 'Vainilla', cantidad: 1, unidad: 'unidad', precio_unitario: 2 },
        { nombre: 'Pasta', cantidad: 1, unidad: 'kg', precio_unitario: 2 }
      ];
      const batch = db.batch();
      for (const item of data) {
        batch.set(db.collection('receta_ingredientes').doc(), { ...item, created_at: new Date().toISOString() });
      }
      await batch.commit();
    }

  } catch (err) {
    console.error('[Seed] Error:', err.message);
  }
}

module.exports = { seedDefaults };
