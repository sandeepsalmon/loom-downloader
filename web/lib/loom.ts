/** Extract 32-char hex video ID from a Loom URL. */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /loom\.com\/share\/([a-f0-9]{32})/,
    /loom\.com\/embed\/([a-f0-9]{32})/,
    /loom\.com\/v\/([a-f0-9]{32})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Bare 32-char hex ID (no URL)
  if (/^[a-f0-9]{32}$/.test(url.trim())) return url.trim();

  return null;
}

/** Validate that a string looks like a Loom URL or bare video ID. */
export function isLoomUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

export const LOOM_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.loom.com/",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export const ALLOWED_HOSTS = [
  "luna.loom.com",
  "cdn.loom.com",
  "cdn-cf.loom.com",
  "d2eebagvwr542c.cloudfront.net",
  "d1aeb47dbf4gw4.cloudfront.net",
];
