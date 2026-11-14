import {NextRequest} from "next/server";
import {apiError,apiSuccess} from "@/lib/api-response";
import {isAuthFailure,requireSuperAdmin} from "@/lib/admin-api";
import {prisma} from "@/lib/prisma";

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireSuperAdmin(request);if(isAuthFailure(auth))return auth;const{id}=await params;const product=await prisma.product.findUnique({where:{id},select:{id:true,name:true,sku:true}});if(!product)return apiError(404,"NOT_FOUND","Product was not found.");const items=await prisma.productPriceHistory.findMany({where:{productId:id},orderBy:{updatedAt:"desc"},include:{updatedBy:{select:{firstName:true,lastName:true,email:true}}}});return apiSuccess({product,items})}
