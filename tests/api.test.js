const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: 'localhost',
      port: 3000,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL: ${msg}`);
  }
}

async function testConfig() {
  console.log('\n--- CONFIG ---');
  const r = await request('GET', '/api/config');
  assert(r.status === 200, 'GET /config returns 200');
  assert(r.body.ok === true, 'GET /config returns ok:true');
  assert(r.body.data.tasa_dolar !== undefined, 'Config has tasa_dolar');

  const r2 = await request('PUT', '/api/config', { key: 'test_key', value: 'test_value' });
  assert(r2.status === 200, 'PUT /config returns 200');
  assert(r2.body.data.value === 'test_value', 'PUT /config saves value');
}

async function testTamanos() {
  console.log('\n--- TAMANOS ---');
  const r = await request('GET', '/api/tamanos');
  assert(r.status === 200, 'GET /tamanos returns 200');
  assert(Array.isArray(r.body.data), 'GET /tamanos returns array');
  assert(r.body.data.length >= 3, 'Has at least 3 default sizes');

  const r2 = await request('POST', '/api/tamanos', { nombre: 'TestSize', precio_usd: 5 });
  assert(r2.status === 200, 'POST /tamanos returns 200');
  assert(r2.body.data.nombre === 'TestSize', 'POST /tamanos creates size');

  const id = r2.body.data.id;
  const r3 = await request('PUT', `/api/tamanos/${id}`, { precio_usd: 6 });
  assert(r3.status === 200, 'PUT /tamanos/:id returns 200');

  const r4 = await request('DELETE', `/api/tamanos/${id}`);
  assert(r4.status === 200, 'DELETE /tamanos/:id returns 200');
}

async function testVendedores() {
  console.log('\n--- VENDEDORES ---');
  const r = await request('GET', '/api/vendedores');
  assert(r.status === 200, 'GET /vendedores returns 200');
  assert(r.body.data.length >= 1, 'Has at least 1 default seller');
}

async function testClientes() {
  console.log('\n--- CLIENTES ---');
  const r = await request('POST', '/api/clientes', { nombre: 'TestClient', telefono: '123' });
  assert(r.status === 200, 'POST /clientes returns 200');
  assert(r.body.data.nombre === 'TestClient', 'POST /clientes creates client');

  const id = r.body.data.id;
  const r2 = await request('GET', '/api/clientes');
  assert(r2.status === 200, 'GET /clientes returns 200');

  const r3 = await request('DELETE', `/api/clientes/${id}`);
  assert(r3.status === 200, 'DELETE /clientes/:id returns 200');
}

async function testVentas() {
  console.log('\n--- VENTAS ---');
  const r = await request('POST', '/api/ventas', {
    tipo_producto: 'chicha',
    producto_nombre: 'Test',
    precio_usd: 2.5,
  });
  assert(r.status === 200, 'POST /ventas returns 200');
  assert(r.body.data.precio_usd === 2.5, 'POST /ventas saves price');

  const id = r.body.data.id;
  const r2 = await request('GET', '/api/ventas');
  assert(r2.status === 200, 'GET /ventas returns 200');

  const r3 = await request('DELETE', `/api/ventas/${id}`);
  assert(r3.status === 200, 'DELETE /ventas/:id returns 200');
}

async function testReportes() {
  console.log('\n--- REPORTES ---');
  const today = new Date().toISOString().slice(0, 10);
  const r = await request('GET', `/api/reportes/resumen?desde=${today}&hasta=${today}`);
  assert(r.status === 200, 'GET /reportes/resumen returns 200');
  assert(r.body.ok === true, 'Reportes returns ok:true');
  assert(r.body.data.totales !== undefined, 'Reportes has totales');
}

async function testInventario() {
  console.log('\n--- INVENTARIO ---');
  const r = await request('POST', '/api/inventario', { nombre: 'TestItem', unidad: 'kg', stock: 10 });
  assert(r.status === 200, 'POST /inventario returns 200');

  const id = r.body.data.id;
  const r2 = await request('GET', '/api/inventario');
  assert(r2.status === 200, 'GET /inventario returns 200');

  const r3 = await request('POST', `/api/inventario/${id}/movimientos`, { cantidad: 5, tipo: 'out', nota: 'test' });
  assert(r3.status === 200, 'POST /inventario/:id/movimientos returns 200');
  assert(r3.body.data.stock === 5, 'Stock reduced correctly');

  const r4 = await request('DELETE', `/api/inventario/${id}`);
  assert(r4.status === 200, 'DELETE /inventario/:id returns 200');
}

async function testReceta() {
  console.log('\n--- RECETA ---');
  const r = await request('GET', '/api/receta/ingredientes');
  assert(r.status === 200, 'GET /receta/ingredientes returns 200');
  assert(Array.isArray(r.body.data), 'Receta returns array');
}

async function testBackup() {
  console.log('\n--- BACKUP ---');
  const r = await request('POST', '/api/backup');
  assert(r.status === 200, 'POST /backup returns 200');
  assert(r.body.data.backup !== null, 'Backup created');
}

async function testErrorHandling() {
  console.log('\n--- ERROR HANDLING ---');
  const r = await request('POST', '/api/ventas', {});
  assert(r.status === 400, 'POST /ventas with missing data returns 400');
  assert(r.body.ok === false, 'Error response has ok:false');
  assert(r.body.error !== undefined, 'Error response has error message');
}

async function runTests() {
  console.log('=== Control Chicha API Tests ===\n');

  try {
    await testConfig();
    await testTamanos();
    await testVendedores();
    await testClientes();
    await testVentas();
    await testReportes();
    await testInventario();
    await testReceta();
    await testBackup();
    await testErrorHandling();
  } catch (e) {
    console.error('Test error:', e.message);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
