import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{id:string}> }) {
  const user = await getAuthenticatedUserFromRequest(request); if (!user || !["SUPER_ADMIN", "SALES_EXECUTIVE"].includes(user.role)) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params; const customer=await prisma.customer.findFirst({where:{id,...(user.role==="SALES_EXECUTIVE"?{assignedSalesExecutiveId:user.id}:{})},include:{assignedSalesExecutive:{select:{id:true,firstName:true,lastName:true}},salesOrders:{select:{id:true,orderNumber:true,status:true,orderDate:true,totalAmount:true},orderBy:{orderDate:"desc"},take:20},convertedFromLead:{include:{leadProducts:{include:{product:{select:{id:true,name:true,sku:true,isActive:true,wholesalePrice:true,minimumOrderQuantity:true}}}},documents:true,activities:{orderBy:{createdAt:"desc"}},verificationChecks:{orderBy:{updatedAt:"desc"}},assignments:{orderBy:{createdAt:"desc"},include:{assignedTo:{select:{firstName:true,lastName:true}},assignedBy:{select:{firstName:true,lastName:true}}}},followUps:{orderBy:{createdAt:"desc"}}}}}});
  if(!customer)return NextResponse.json({error:"Customer not found"},{status:404}); return NextResponse.json(customer);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{id:string}> }) {
  const user=await getAuthenticatedUserFromRequest(request); if(!user||user.role!=="SUPER_ADMIN")return NextResponse.json({error:"Super Admin access required"},{status:403});
  const {id}=await params; const input=await request.json(); const allowed=["businessName","businessType","buyerName","mobile","whatsappNumber","email","gstin","website","socialMediaUrl","businessAddress","city","state","pincode","country","preferredContactMethod","preferredPaymentMode","deliveryAddress","deliveryCity","deliveryState","deliveryPincode","deliveryContactName","deliveryContactPhone","status","assignedSalesExecutiveId"];
  const data=Object.fromEntries(Object.entries(input).filter(([key])=>allowed.includes(key)));
  for (const key of ["whatsappNumber", "gstin", "website", "socialMediaUrl", "businessAddress", "deliveryAddress", "deliveryCity", "deliveryState", "deliveryPincode", "deliveryContactName", "deliveryContactPhone", "assignedSalesExecutiveId"]) if (data[key] === "") data[key] = null;
  for (const key of ["businessName", "buyerName", "mobile", "email", "city", "state", "pincode"]) if (key in data && typeof data[key] === "string") data[key] = String(data[key]).trim();
  for (const key of ["businessAddress", "deliveryAddress", "deliveryCity", "deliveryState", "deliveryPincode", "deliveryContactName", "deliveryContactPhone"]) if (key in data && typeof data[key] === "string") data[key] = String(data[key]).trim();
  if (typeof data.email === "string" && !/^\S+@\S+\.\S+$/.test(data.email)) return NextResponse.json({error:"Enter a valid email address."},{status:400});
  if (["businessName", "buyerName", "mobile", "email", "city", "state", "pincode"].some(key=>key in data&&!data[key])) return NextResponse.json({error:"Required customer details cannot be empty."},{status:400});
  if (["businessAddress", "deliveryAddress", "deliveryCity", "deliveryState", "deliveryPincode"].some(key=>key in data&&!data[key])) return NextResponse.json({error:"Billing and shipping address details cannot be empty."},{status:400});
  if (typeof data.deliveryPincode === "string" && data.deliveryPincode) {
    const postal = data.deliveryPincode.replace(/[\s-]/g, "").toUpperCase();
    const country = typeof data.country === "string" ? data.country : (await prisma.customer.findUnique({ where: { id }, select: { country: true } }))?.country ?? "India";
    const valid = country.toLowerCase() === "india" ? /^[1-9][0-9]{5}$/.test(postal) : /^[A-Z0-9][A-Z0-9 -]{1,13}[A-Z0-9]$/.test(postal);
    if (!valid) return NextResponse.json({error:"Enter a valid shipping postal code."},{status:400});
    data.deliveryPincode = postal;
  }
  if (typeof data.deliveryContactPhone === "string" && data.deliveryContactPhone && !/^\+?[0-9\s()-]{7,20}$/.test(data.deliveryContactPhone)) return NextResponse.json({error:"Enter a valid shipping contact phone number."},{status:400});
  if(data.status&&! ["ACTIVE","INACTIVE","BLOCKED"].includes(String(data.status)))return NextResponse.json({error:"Invalid customer status"},{status:400});
  try { const updated=await prisma.$transaction(async tx=>{const before=await tx.customer.findUnique({where:{id}});if(!before)throw new Error("Customer not found");if(data.assignedSalesExecutiveId){const exec=await tx.user.findFirst({where:{id:String(data.assignedSalesExecutiveId),role:"SALES_EXECUTIVE",isActive:true}});if(!exec)throw new Error("Choose an active Sales Executive.");}const customer=await tx.customer.update({where:{id},data});await tx.customerAuditEvent.create({data:{customerId:id,actorId:user.id,action:"CUSTOMER_UPDATED",details:{changedFields:Object.keys(data),beforeStatus:before.status,afterStatus:customer.status}}});return customer;});return NextResponse.json(updated);} catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Update failed"},{status:400});}
}
