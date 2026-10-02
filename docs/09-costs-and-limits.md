# 9. Costs and limits

Mister Admin uses four Cloudflare products. All have a free tier. Figures below are Cloudflare's
published free limits at the time of writing (2026); check cloudflare.com/plans for current numbers.

| Product | Used for | Free tier | What that means for you |
|---|---|---|---|
| Pages | hosting your websites | unlimited sites, unlimited bandwidth, 500 builds/month | never a problem |
| Workers | Mister Admin itself (UI + API) | 100 000 requests per day | ~100 000 page views of all your sites per day |
| D1 | the database | 5 GB storage, 5 M reads/day, 100 000 writes/day | thousands of sites' worth of content |
| R2 | photo files | 10 GB storage, 10 M reads/month, zero egress fees | ~20 000 photos, unlimited views |

Public content requests are cached at the edge for 60 s and photos for a year, so most website
traffic never counts against Workers or D1 at all.

**First paid step:** Workers Paid at $5/month if you exceed 100 000 requests/day. R2 beyond 10 GB is
$0.015/GB/month. There are no other costs. Your own domain name is paid to your registrar as usual.

## Hard limits in the app

| | Limit |
|---|---|
| Collections per site | 100 |
| Fields per collection | 60 |
| Items per list/tree | 2 000 |
| Tree depth | 3 |
| One collection's JSON | ~900 KB |
| Gallery field | 200 photos |
| Photo variants | 480 / 1200 / 2000 px, ≤ 4 MB each |
| Source photo | 60 MB, 80 megapixels |
| Sites per instance | unlimited |
| Users | unlimited |
| History per site | last 200 shown (all kept) |

Workers request body limit on the free plan is 100 MB; uploads are far below that because
photos are shrunk in the browser first.
