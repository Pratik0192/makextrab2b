import { NextResponse, NextRequest } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";

export const POST = async (req: NextRequest) => {
  if (!(await getAuthenticatedUserFromRequest(req))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {

    return NextResponse.json({
      success: true,
      
    });
  } catch (error) {
    console.error('[Add Client Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
