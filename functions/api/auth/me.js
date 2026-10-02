import { json } from '../../_lib/http.js';

export async function onRequestGet({ data }) {
  return json({ user: data.user || null });
}
