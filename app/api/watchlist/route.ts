import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    const { rows } = await sql`SELECT * FROM favorites`;
    return NextResponse.json({ watchlist: rows }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { stock_name } = await request.json();
    await sql`INSERT INTO favorites (stock_name) VALUES (${stock_name})`;
    return NextResponse.json({ message: 'Stock added to watchlist' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add stock to watchlist' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { stock_name } = await request.json();
    await sql`DELETE FROM favorites WHERE stock_name = ${stock_name}`;
    return NextResponse.json({ message: 'Stock removed from watchlist' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to remove stock from watchlist' }, { status: 500 });
  }
}

