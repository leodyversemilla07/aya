import { auth } from '@workspace/auth';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return NextResponse.next();

  const signIn = new URL('/sign-in', request.url);
  signIn.searchParams.set('callbackUrl', request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ['/((?!api/auth|sign-in|sign-up|_next|favicon.ico).*)'],
};
