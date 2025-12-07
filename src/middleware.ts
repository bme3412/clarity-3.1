import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/chat')) {
    return NextResponse.next();
  }

  const token = process.env.CHAT_API_TOKEN;
  if (token) {
    const headerToken = request.headers.get('x-api-key');
    if (headerToken !== token) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const clientKey =
    request.headers.get('x-forwarded-for') ||
    request.ip ||
    'anonymous';

  const rate = checkRateLimit(clientKey);
  if (!rate.allowed) {
    return new NextResponse('Rate limit exceeded', {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((rate.resetAt! - Date.now()) / 1000).toString()
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/chat/:path*']
};
