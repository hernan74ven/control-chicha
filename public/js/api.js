const API = '/api';

export async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error del servidor');
  return json.data;
}
