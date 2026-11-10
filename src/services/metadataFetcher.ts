import type { SavedLink, WishlistItem } from '@/types';

interface LinkMetadata {
  title: string;
  description?: string;
  imageUrl?: string;
  domain: string;
  favicon?: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Prova a usare l'API di Open Graph tramite allorigins (proxy CORS gratuito)
async function fetchViaProxy(url: string): Promise<string | null> {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.contents as string;
  } catch {
    return null;
  }
}

function parseMetaFromHtml(html: string, url: string): LinkMetadata {
  const domain = extractDomain(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getMetaContent = (name: string): string | undefined => {
    return (
      doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
      undefined
    );
  };

  const title =
    getMetaContent('og:title') ||
    getMetaContent('twitter:title') ||
    doc.querySelector('title')?.textContent ||
    domain;

  const description =
    getMetaContent('og:description') ||
    getMetaContent('twitter:description') ||
    getMetaContent('description');

  const imageUrl =
    getMetaContent('og:image') ||
    getMetaContent('twitter:image');

  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  return {
    title: title?.trim() || domain,
    description: description?.trim(),
    imageUrl,
    domain,
    favicon,
  };
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const domain = extractDomain(url);
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // Default fallback
  const fallback: LinkMetadata = { title: domain, domain, favicon };

  if (!navigator.onLine) return fallback;

  try {
    // Prima prova fetch diretto (funziona per siti senza CORS strict)
    const html = await fetchViaProxy(url);
    if (html) {
      const meta = parseMetaFromHtml(html, url);
      return { ...fallback, ...meta };
    }
  } catch {
    // Ignora errori
  }

  return fallback;
}

export function buildSavedLinkFromMetadata(url: string, meta: LinkMetadata): Partial<SavedLink> {
  return {
    url,
    title: meta.title,
    description: meta.description,
    imageUrl: meta.imageUrl,
    domain: meta.domain,
    favicon: meta.favicon,
  };
}

export function buildWishlistItemFromMetadata(url: string, meta: LinkMetadata): Partial<WishlistItem> {
  return {
    url,
    name: meta.title,
    description: meta.description,
    imageUrl: meta.imageUrl,
  };
}
