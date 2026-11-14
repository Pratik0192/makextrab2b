import { NextRequest } from "next/server";
import { handleTaxonomyImage } from "@/lib/taxonomy-image-api";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return handleTaxonomyImage(request, "collections", id);
}
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = await context.params;
  return handleTaxonomyImage(request, "collections", id, true);
}
