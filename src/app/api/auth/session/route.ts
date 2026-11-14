import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
export async function GET(request: NextRequest) { const user = await getAuthenticatedUserFromRequest(request); if (!user) return apiError(401, "UNAUTHENTICATED", "Sign in required."); return apiSuccess({ id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email }); }
