export function publicCacheKey(request, slug) {
  const origin = new URL(request.url).origin;
  return new Request(`${origin}/api/public/${slug}/content`, { method: 'GET' });
}
