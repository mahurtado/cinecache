import MoviesShowcase from "./MoviesShowcase";

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'https://movies-backend-215265975223.europe-west1.run.app';
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || '';

// Helper to retrieve Google ID Token dynamically on the server-side when running in GCP
async function fetchGcpIdToken(): Promise<string> {
  if (BACKEND_TOKEN) {
    return BACKEND_TOKEN;
  }
  try {
    const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(BACKEND_URL)}`;
    const response = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      const token = await response.text();
      return token.trim();
    }
  } catch (error) {
    console.warn('GCP Metadata server not reachable on server-side page render. Falling back.');
  }
  return '';
}

// Fetch Genres catalog directly during server-side rendering
async function getGenres() {
  const token = await fetchGcpIdToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/genres`, {
      headers,
      next: { revalidate: 300 }, // Cache genres catalog for 5 minutes in Next.js cache
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (error) {
    console.error('Failed to fetch genres on server-side:', error);
  }
  return [];
}

export default async function Page() {
  // Pre-fetch genres on the server before returning initial HTML
  const genres = await getGenres();
  return <MoviesShowcase initialGenres={genres} />;
}
