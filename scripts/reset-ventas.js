const { GoogleAuth } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function reset() {
  const saPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
  const auth = new GoogleAuth({ keyFile: saPath, scopes: 'https://www.googleapis.com/auth/datastore' });
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const projectId = 'pandichicha-2026';
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ventas`;

  // List all documents
  const listRes = await fetch(base + '?pageSize=500', {
    headers: { Authorization: `Bearer ${token.token}` }
  });
  const list = await listRes.json();
  if (!list.documents || list.documents.length === 0) {
    console.log('No hay ventas para borrar');
    return;
  }

  // Delete each document
  const names = list.documents.map(d => d.name);
  for (const name of names) {
    await fetch(name, { method: 'DELETE', headers: { Authorization: `Bearer ${token.token}` } });
  }
  console.log(`Eliminadas ${names.length} ventas`);
}

reset().catch(e => console.error(e.message)).finally(() => process.exit(0));
