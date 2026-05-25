import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://movies-backend-215265975223.europe-west1.run.app';
const BACKEND_TOKEN = process.env.BACKEND_TOKEN || '';

// Helper to fetch Google ID Token dynamically from the metadata server when running on GCP
async function fetchGcpIdToken(): Promise<string> {
  // If a token is explicitly provided (for local dev), use it
  if (BACKEND_TOKEN) {
    return BACKEND_TOKEN;
  }

  try {
    const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(BACKEND_URL)}`;
    const response = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
      // Set a small timeout to avoid hanging locally
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const token = await response.text();
      return token.trim();
    }
  } catch (error) {
    // Metadata server not reachable (normal during local dev)
    console.warn('Google Metadata server not reachable. Falling back to unauthenticated request.');
  }

  return '';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const path = slug ? slug.join('/') : '';
  const searchParams = request.nextUrl.searchParams.toString();
  
  const targetUrl = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;
  console.log(`Proxying GET request to: ${targetUrl}`);

  const token = await fetchGcpIdToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Backend error: ${res.statusText}`, details: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy GET error:', error);
    return NextResponse.json({ error: 'Failed to connect to backend service', details: error.message }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const path = slug ? slug.join('/') : '';
  
  const targetUrl = `${BACKEND_URL}/${path}`;
  console.log(`Proxying POST request to: ${targetUrl}`);

  const token = await fetchGcpIdToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const body = await request.json();
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Backend error: ${res.statusText}`, details: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy POST error:', error);
    return NextResponse.json({ error: 'Failed to connect to backend service', details: error.message }, { status: 502 });
  }
}
