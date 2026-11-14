import { NextResponse } from "next/server";

// General public registration was part of a retired authentication flow.
// Initial admin setup is available only through the guarded bootstrap endpoint.
export async function POST() {
  return NextResponse.json(
    { error: "Public registration is unavailable." },
    { status: 404 },
  );
}
