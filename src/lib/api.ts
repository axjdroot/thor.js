import { NextResponse } from 'next/server';

export function ok<T>(data: T, meta?: any) {
  return NextResponse.json({
    data,
    meta,
  });
}

export function err(code: string, message: string, status: number = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}
