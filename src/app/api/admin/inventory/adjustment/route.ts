import { NextRequest } from "next/server";
import { handleStockMovement } from "@/lib/inventory-api";

export async function POST(request: NextRequest) {
  return handleStockMovement(request, "adjustment");
}
