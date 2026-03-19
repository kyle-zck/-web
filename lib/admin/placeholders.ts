function svgDataUri(svg: string) {
  const encoded = encodeURIComponent(svg).replace(/%0A/g, "").replace(/%20/g, " ");
  return `data:image/svg+xml;utf8,${encoded}`;
}

export function coverPlaceholder(title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1020"/>
        <stop offset="100%" stop-color="#120a2a"/>
      </linearGradient>
    </defs>
    <rect width="900" height="1200" fill="url(#g)"/>
    <rect x="44" y="44" width="812" height="1112" rx="56" fill="#000" opacity="0.35" stroke="#7C3AED" stroke-opacity="0.35"/>
    <text x="90" y="980" fill="#fff" font-family="ui-sans-serif, system-ui, -apple-system" font-size="44" font-weight="700">${title}</text>
    <text x="90" y="1042" fill="#a1a1aa" font-family="ui-sans-serif, system-ui, -apple-system" font-size="26">${subtitle}</text>
    <text x="90" y="1110" fill="#7C3AED" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20" font-weight="600">Mock Cover</text>
  </svg>`;
  return svgDataUri(svg);
}

export function posterPlaceholder(title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1f1147"/>
        <stop offset="55%" stop-color="#0b1020"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
    </defs>
    <rect width="720" height="1280" fill="url(#g)"/>
    <circle cx="540" cy="260" r="220" fill="#7C3AED" opacity="0.22"/>
    <circle cx="160" cy="980" r="260" fill="#7C3AED" opacity="0.14"/>
    <rect x="36" y="900" width="648" height="320" rx="44" fill="#000" opacity="0.52"/>
    <text x="72" y="980" fill="#fff" font-family="ui-sans-serif, system-ui, -apple-system" font-size="54" font-weight="700">${title}</text>
    <text x="72" y="1046" fill="#cbd5e1" font-family="ui-sans-serif, system-ui, -apple-system" font-size="28">${subtitle}</text>
    <text x="72" y="1124" fill="#7C3AED" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="600">Mock Poster · 9:16</text>
  </svg>`;
  return svgDataUri(svg);
}

export function episodeThumbPlaceholder(title: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="404" viewBox="0 0 720 404">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1020"/>
        <stop offset="100%" stop-color="#120a2a"/>
      </linearGradient>
    </defs>
    <rect width="720" height="404" fill="url(#g)"/>
    <rect x="20" y="22" width="680" height="360" rx="28" fill="#000" opacity="0.35" stroke="#7C3AED" stroke-opacity="0.35"/>
    <text x="52" y="175" fill="#fff" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="700">${title}</text>
    <text x="52" y="235" fill="#a1a1aa" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20">${label}</text>
    <text x="52" y="315" fill="#7C3AED" font-family="ui-sans-serif, system-ui, -apple-system" font-size="16" font-weight="600">Episode Thumb</text>
  </svg>`;
  return svgDataUri(svg);
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s\W]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

