import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { getAuthenticatedUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Range = { from: Date; to: Date };
type SeriesPoint = { date: string; leads: number; converted: number; invoiced: number };
type ActivityItem = { id: string; kind: string; title: string; detail: string; actor: string; at: Date; href: string };

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  // The business operates in India. Interpret date controls as inclusive Asia/Kolkata calendar days.
  const calendarDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value) return null;
  const parsed = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value ?? 0) || 0;
}

function actorName(actor?: { firstName: string; lastName: string } | null) {
  return actor ? `${actor.firstName} ${actor.lastName}`.trim() : "System";
}

function logDashboardFailure(stage: string, error: unknown, range?: Range) {
  const details = error instanceof Error ? error : new Error(String(error));
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  console.error("[admin-dashboard] failure", {
    stage,
    ...(range ? { from: range.from.toISOString(), toExclusive: range.to.toISOString() } : {}),
    errorName: details.name,
    errorMessage: details.message,
    prismaCode: code,
    stack: details.stack,
  });
}

function traceDashboardQuery<T>(name: string, query: Promise<T>, range: Range): Promise<T> {
  return query.catch((error: unknown) => {
    logDashboardFailure(`query:${name}`, error, range);
    throw error;
  });
}

function isDatabaseUnavailable(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  const metaCode = "meta" in error && typeof error.meta === "object" && error.meta !== null && "code" in error.meta ? String(error.meta.code) : "";
  return [code, metaCode].some((candidate) => ["P1001", "P1002", "P1008", "P1017"].includes(candidate));
}

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await getAuthenticatedUserFromRequest(request);
  } catch (error) {
    logDashboardFailure("authentication_lookup", error);
    return NextResponse.json({ error: "Dashboard authentication is temporarily unavailable." }, { status: 503 });
  }
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super Admin access is required." }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const from = parseDate(params.get("from"));
  const toDate = parseDate(params.get("to"));
  if (!from || !toDate) return NextResponse.json({ error: "Provide valid from and to dates in YYYY-MM-DD format." }, { status: 400 });
  if (from > toDate) return NextResponse.json({ error: "The start date must be on or before the end date." }, { status: 400 });
  const to = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
  if (to.getTime() - from.getTime() > 5 * 366 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Choose a date range of five years or less." }, { status: 400 });
  const range: Range = { from, to };
  const duration = to.getTime() - from.getTime();
  const previous: Range = { from: new Date(from.getTime() - duration), to: from };
  const now = new Date();
  const bucket = duration <= 32 * 86400000 ? "day" : duration <= 180 * 86400000 ? "week" : "month";
  const activeLead = { mergedIntoLeadId: null };
  const invoiceWhere = (r: Range): Prisma.InvoiceWhereInput => ({ status: { in: ["ISSUED", "CREDIT_NOTED"] }, issuedAt: { gte: r.from, lt: r.to } });

  try {
    const [
      totalLeads, newLeads, previousLeads, qualifiedLeads, convertedLeads, previousConvertedLeads, allConvertedLeads,
      pipelineRows, priorityRows, totalCustomers, customers, orderRows,
      invoiceSummary, invoiceCount, previousInvoiceSummary, payments, creditNotes, pendingInvoices, outstandingSummary,
      activeProducts, activeWarehouses, stockSummary, lowStockRows,
      followUps, recentLeads, recentOrders, recentInvoices,
      executives, company, leadTrend, conversionTrend, invoiceTrend, topProducts,
      leadActivities, assignments, orderEvents, deliveryEvents,
      invoiceEvents, paymentEvents, creditEvents,
    ] = await Promise.all([
      prisma.lead.count({ where: activeLead }),
      prisma.lead.count({ where: { ...activeLead, createdAt: { gte: range.from, lt: range.to } } }),
      prisma.lead.count({ where: { ...activeLead, createdAt: { gte: previous.from, lt: previous.to } } }),
      prisma.lead.count({ where: { ...activeLead, stage: "QUALIFIED" } }),
      prisma.customer.count({ where: { convertedFromLeadId: { not: null }, convertedAt: { gte: range.from, lt: range.to }, convertedFromLead: { mergedIntoLeadId: null } } }),
      prisma.customer.count({ where: { convertedFromLeadId: { not: null }, convertedAt: { gte: previous.from, lt: previous.to }, convertedFromLead: { mergedIntoLeadId: null } } }),
      prisma.lead.count({ where: { ...activeLead, stage: "CONVERTED" } }),
      prisma.lead.groupBy({ by: ["stage"], where: activeLead, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ["priority"], where: activeLead, _count: { _all: true } }),
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      prisma.salesOrder.groupBy({ by: ["status"], where: { orderDate: { gte: range.from, lt: range.to }, status: { not: "CANCELLED" } }, _count: { _all: true } }),
      prisma.invoice.aggregate({ where: invoiceWhere(range), _sum: { grandTotal: true }, _count: { _all: true } }),
      prisma.invoice.count({ where: invoiceWhere(range) }),
      prisma.invoice.aggregate({ where: invoiceWhere(previous), _sum: { grandTotal: true } }),
      prisma.invoicePayment.aggregate({ where: { status: "RECORDED", paymentDate: { gte: range.from, lt: range.to }, invoice: { status: { in: ["ISSUED", "CREDIT_NOTED"] } } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.creditNote.aggregate({ where: { status: "ISSUED", issueDate: { gte: range.from, lt: range.to } }, _sum: { grandTotal: true }, _count: { _all: true } }),
      prisma.invoice.count({ where: { ...invoiceWhere(range), outstandingAmount: { gt: 0 } } }),
      prisma.invoice.aggregate({ where: { ...invoiceWhere(range), outstandingAmount: { gt: 0 } }, _sum: { outstandingAmount: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.warehouse.count({ where: { isActive: true } }),
      prisma.stockBalance.aggregate({ where: { product: { isActive: true }, warehouse: { isActive: true } }, _sum: { quantityOnHand: true, quantityReserved: true, quantityBlocked: true } }),
      traceDashboardQuery("inventory.lowStock", prisma.$queryRaw<Array<{ id: string; productName: string; sku: string; warehouseName: string; available: number; reorderLevel: number }>>`
        SELECT b."id", p."name" AS "productName", p."sku", w."name" AS "warehouseName",
          (b."quantityOnHand" - b."quantityReserved" - b."quantityBlocked") AS "available", b."reorderLevel"
        FROM "StockBalance" b JOIN "Product" p ON p."id" = b."productId" JOIN "Warehouse" w ON w."id" = b."warehouseId"
        WHERE b."reorderLevel" IS NOT NULL AND p."isActive" = true AND w."isActive" = true
          AND (b."quantityOnHand" - b."quantityReserved" - b."quantityBlocked") <= b."reorderLevel"
        ORDER BY ((b."quantityOnHand" - b."quantityReserved" - b."quantityBlocked") - b."reorderLevel") ASC, p."name" ASC LIMIT 6
      `, range),
      prisma.leadFollowUp.findMany({ where: { status: "PENDING", dueAt: { lte: new Date(now.getTime() + 14 * 86400000) }, lead: activeLead }, orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: 10, select: { id: true, dueAt: true, note: true, status: true, lead: { select: { id: true, referenceNumber: true, businessName: true } }, assignedTo: { select: { firstName: true, lastName: true } } } }),
      prisma.lead.findMany({ where: { createdAt: { gte: range.from, lt: range.to }, ...activeLead }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, referenceNumber: true, businessName: true, city: true, stage: true, source: true, createdAt: true } }),
      prisma.salesOrder.findMany({ where: { orderDate: { gte: range.from, lt: range.to }, status: { not: "CANCELLED" } }, orderBy: { orderDate: "desc" }, take: 5, select: { id: true, orderNumber: true, status: true, orderDate: true, totalAmount: true, customer: { select: { businessName: true } } } }),
      prisma.invoice.findMany({ where: { ...invoiceWhere(range), invoiceNumber: { not: null } }, orderBy: { issuedAt: "desc" }, take: 5, select: { id: true, invoiceNumber: true, status: true, issuedAt: true, grandTotal: true, customer: { select: { businessName: true } } } }),
      prisma.user.findMany({ where: { role: "SALES_EXECUTIVE", isActive: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: 50, select: { id: true, firstName: true, lastName: true } }),
      prisma.companySettings.findUnique({ where: { id: "main" }, select: { legalBusinessName: true, tradeName: true, invoiceHeaderName: true } }),
      traceDashboardQuery("crm.leadTrend", prisma.$queryRaw<Array<{ date: string; count: bigint }>>`SELECT to_char(date_trunc(${bucket}, "createdAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS date, COUNT(*) AS count FROM "Lead" WHERE "mergedIntoLeadId" IS NULL AND "createdAt" >= ${range.from} AND "createdAt" < ${range.to} GROUP BY date ORDER BY date`, range),
      traceDashboardQuery("crm.conversionTrend", prisma.$queryRaw<Array<{ date: string; count: bigint }>>`SELECT to_char(date_trunc(${bucket}, c."convertedAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS date, COUNT(*) AS count FROM "Customer" c JOIN "Lead" l ON l.id = c."convertedFromLeadId" WHERE l."mergedIntoLeadId" IS NULL AND c."convertedFromLeadId" IS NOT NULL AND c."convertedAt" >= ${range.from} AND c."convertedAt" < ${range.to} GROUP BY date ORDER BY date`, range),
      traceDashboardQuery("sales.invoiceTrend", prisma.$queryRaw<Array<{ date: string; amount: Prisma.Decimal }>>`SELECT to_char(date_trunc(${bucket}, "issuedAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS date, SUM("grandTotal") AS amount FROM "Invoice" WHERE "status" IN ('ISSUED'::"InvoiceStatus", 'CREDIT_NOTED'::"InvoiceStatus") AND "issuedAt" >= ${range.from} AND "issuedAt" < ${range.to} GROUP BY date ORDER BY date`, range),
      traceDashboardQuery("sales.topProducts", prisma.$queryRaw<Array<{ name: string; sku: string; quantity: bigint; amount: Prisma.Decimal }>>`
        SELECT COALESCE(ii."productName", p."name") AS name, COALESCE(ii."sku", p."sku") AS sku,
          GREATEST(SUM(ii."quantity") - COALESCE(SUM(credits.quantity), 0), 0)::bigint AS quantity,
          (SUM(ii."lineTotal") - COALESCE(SUM(credits.amount), 0)) AS amount
        FROM "InvoiceItem" ii JOIN "Invoice" i ON i.id = ii."invoiceId" LEFT JOIN "Product" p ON p.id = ii."productId"
        LEFT JOIN (SELECT cni."invoiceItemId", SUM(cni."quantity") AS quantity, SUM(cni."totalAmount") AS amount
          FROM "CreditNoteItem" cni JOIN "CreditNote" cn ON cn.id = cni."creditNoteId"
          WHERE cn.status = 'ISSUED'::"CreditNoteStatus" AND cn."issueDate" >= ${range.from} AND cn."issueDate" < ${range.to} GROUP BY cni."invoiceItemId") credits ON credits."invoiceItemId" = ii.id
        WHERE i."status" IN ('ISSUED'::"InvoiceStatus", 'CREDIT_NOTED'::"InvoiceStatus") AND i."issuedAt" >= ${range.from} AND i."issuedAt" < ${range.to}
        GROUP BY COALESCE(ii."productName", p."name"), COALESCE(ii."sku", p."sku") ORDER BY quantity DESC, amount DESC LIMIT 7
      `, range),
      prisma.leadActivity.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, activityType: true, description: true, createdAt: true, lead: { select: { id: true, referenceNumber: true, businessName: true, mergedIntoLeadId: true } }, createdBy: { select: { firstName: true, lastName: true } } } }),
      prisma.leadAssignment.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, createdAt: true, lead: { select: { id: true, referenceNumber: true, businessName: true, mergedIntoLeadId: true } }, assignedTo: { select: { firstName: true, lastName: true } }, assignedBy: { select: { firstName: true, lastName: true } } } }),
      prisma.salesOrderEvent.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, action: true, createdAt: true, salesOrder: { select: { id: true, orderNumber: true, customer: { select: { businessName: true } } } }, actor: { select: { firstName: true, lastName: true } } } }),
      prisma.deliveryStatusEvent.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, previousStatus: true, newStatus: true, createdAt: true, dispatch: { select: { id: true, reference: true, salesOrder: { select: { id: true, customer: { select: { businessName: true } } } } } }, actor: { select: { firstName: true, lastName: true } } } }),
      prisma.invoiceEvent.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, action: true, createdAt: true, invoice: { select: { id: true, invoiceNumber: true, customer: { select: { businessName: true } } } }, actor: { select: { firstName: true, lastName: true } } } }),
      prisma.invoicePaymentEvent.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, action: true, createdAt: true, payment: { select: { status: true, invoice: { select: { id: true, invoiceNumber: true, customer: { select: { businessName: true } } } } } }, actor: { select: { firstName: true, lastName: true } } } }),
      prisma.creditNoteEvent.findMany({ where: { createdAt: { gte: range.from, lt: range.to } }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, action: true, createdAt: true, creditNote: { select: { id: true, creditNoteNumber: true, invoice: { select: { customer: { select: { businessName: true } } } } } }, actor: { select: { firstName: true, lastName: true } } } }),
    ]);

    const execIds = executives.map((executive) => executive.id);
    const execRows = execIds.length ? await traceDashboardQuery("sales.executivePerformance", prisma.$queryRaw<Array<{ id: string; leads: bigint; converted: bigint; orders: bigint; invoiced: Prisma.Decimal }>>`
      SELECT u.id,
        (SELECT COUNT(*) FROM "Lead" l LEFT JOIN "Customer" c ON c."convertedFromLeadId" = l.id
          WHERE l."mergedIntoLeadId" IS NULL AND (
            CASE WHEN l.stage = 'CONVERTED'::"LeadStage" AND EXISTS (SELECT 1 FROM "LeadAssignment" la WHERE la."leadId" = l.id)
              THEN (SELECT la."assignedToId" FROM "LeadAssignment" la WHERE la."leadId" = l.id AND la."createdAt" <= c."convertedAt" ORDER BY la."createdAt" DESC, la.id DESC LIMIT 1)
              ELSE l."assignedToId" END
          ) = u.id) AS leads,
        (SELECT COUNT(*) FROM "Customer" c JOIN "Lead" l ON l.id = c."convertedFromLeadId"
          WHERE c."convertedFromLeadId" IS NOT NULL AND l."mergedIntoLeadId" IS NULL AND (
            CASE WHEN EXISTS (SELECT 1 FROM "LeadAssignment" la WHERE la."leadId" = l.id)
              THEN (SELECT la."assignedToId" FROM "LeadAssignment" la WHERE la."leadId" = l.id AND la."createdAt" <= c."convertedAt" ORDER BY la."createdAt" DESC, la.id DESC LIMIT 1)
              ELSE l."assignedToId" END
          ) = u.id) AS converted,
        (SELECT COUNT(*) FROM "SalesOrder" so WHERE so."assignedSalesExecutiveId" = u.id AND so.status = 'CONFIRMED'::"SalesOrderStatus" AND so."orderDate" >= ${range.from} AND so."orderDate" < ${range.to}) AS orders,
        (SELECT COALESCE(SUM(i."grandTotal"), 0) FROM "Invoice" i JOIN "SalesOrder" so ON so.id = i."salesOrderId" WHERE so."assignedSalesExecutiveId" = u.id AND i.status IN ('ISSUED'::"InvoiceStatus", 'CREDIT_NOTED'::"InvoiceStatus") AND i."issuedAt" >= ${range.from} AND i."issuedAt" < ${range.to}) AS invoiced
      FROM "User" u
      WHERE u.role = 'SALES_EXECUTIVE'::"UserRole" AND u."isActive" = true
      ORDER BY u."firstName" ASC, u."lastName" ASC, u.id ASC LIMIT 50
    `, range) : [];

    const dateKey = (date: string) => date;
    const pointMap = new Map<string, SeriesPoint>();
    for (const row of leadTrend) pointMap.set(dateKey(row.date), { date: dateKey(row.date), leads: Number(row.count), converted: 0, invoiced: 0 });
    for (const row of conversionTrend) { const key = dateKey(row.date); const point = pointMap.get(key) ?? { date: key, leads: 0, converted: 0, invoiced: 0 }; point.converted = Number(row.count); pointMap.set(key, point); }
    for (const row of invoiceTrend) { const key = dateKey(row.date); const point = pointMap.get(key) ?? { date: key, leads: 0, converted: 0, invoiced: 0 }; point.invoiced = asNumber(row.amount); pointMap.set(key, point); }

    const activities: ActivityItem[] = [
      ...recentLeads.map((item) => ({ id: `created-${item.id}`, kind: "lead", title: "New lead created", detail: `${item.referenceNumber} · ${item.businessName}`, actor: item.source === "WEBSITE" ? "Website enquiry" : `Source: ${item.source.replaceAll("_", " ").toLowerCase()}`, at: item.createdAt, href: `/admin/leads/${item.id}` })),
      ...leadActivities.filter((item) => !item.lead.mergedIntoLeadId).map((item) => ({ id: `lead-${item.id}`, kind: "lead", title: item.description, detail: `${item.lead.referenceNumber} · ${item.lead.businessName}`, actor: actorName(item.createdBy), at: item.createdAt, href: `/admin/leads/${item.lead.id}` })),
      ...assignments.filter((item) => !item.lead.mergedIntoLeadId).map((item) => ({ id: `assign-${item.id}`, kind: "assignment", title: `Lead assigned to ${actorName(item.assignedTo)}`, detail: `${item.lead.referenceNumber} · ${item.lead.businessName}`, actor: actorName(item.assignedBy), at: item.createdAt, href: `/admin/leads/${item.lead.id}` })),
      ...orderEvents.map((item) => ({ id: `order-${item.id}`, kind: "order", title: item.action.replaceAll("_", " ").toLowerCase(), detail: `${item.salesOrder.orderNumber} · ${item.salesOrder.customer.businessName}`, actor: actorName(item.actor), at: item.createdAt, href: `/admin/orders/${item.salesOrder.id}` })),
      ...deliveryEvents.map((item) => ({ id: `dispatch-${item.id}`, kind: "dispatch", title: `Dispatch moved to ${item.newStatus.replaceAll("_", " ").toLowerCase()}`, detail: `${item.dispatch.reference} · ${item.dispatch.salesOrder.customer.businessName}`, actor: actorName(item.actor), at: item.createdAt, href: `/admin/warehouse/orders/${item.dispatch.salesOrder.id}` })),
      ...invoiceEvents.map((item) => ({ id: `invoice-${item.id}`, kind: "invoice", title: item.action.replaceAll("_", " ").toLowerCase(), detail: `${item.invoice.invoiceNumber ?? "Invoice draft"} · ${item.invoice.customer.businessName}`, actor: actorName(item.actor), at: item.createdAt, href: `/admin/invoices/${item.invoice.id}` })),
      ...paymentEvents.map((item) => ({ id: `payment-${item.id}`, kind: "payment", title: item.action.replaceAll("_", " ").toLowerCase(), detail: `${item.payment.invoice.invoiceNumber ?? "Invoice"} · ${item.payment.invoice.customer.businessName}`, actor: actorName(item.actor), at: item.createdAt, href: `/admin/invoices/${item.payment.invoice.id}` })),
      ...creditEvents.map((item) => ({ id: `credit-${item.id}`, kind: "credit", title: item.action.replaceAll("_", " ").toLowerCase(), detail: `${item.creditNote.creditNoteNumber ?? "Credit note"} · ${item.creditNote.invoice.customer.businessName}`, actor: actorName(item.actor), at: item.createdAt, href: `/admin/credit-notes/${item.creditNote.id}` })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 12);

    const invoiced = asNumber(invoiceSummary._sum?.grandTotal);
    const collected = asNumber(payments._sum?.amount);
    const credited = asNumber(creditNotes._sum?.grandTotal);
    const onHand = stockSummary._sum.quantityOnHand ?? 0;
    const reserved = stockSummary._sum.quantityReserved ?? 0;
    const blocked = stockSummary._sum.quantityBlocked ?? 0;
    const orderCounts = Object.fromEntries(orderRows.map((row) => [row.status, row._count._all]));
    const pipeline = Object.fromEntries(pipelineRows.map((row) => [row.stage, row._count._all]));
    const priorities = Object.fromEntries(priorityRows.map((row) => [row.priority, row._count._all]));
    const execById = new Map(execRows.map((row) => [row.id, row]));
    const executivePerformance = executives.map((executive) => {
      const row = execById.get(executive.id);
      const leads = Number(row?.leads ?? 0);
      const converted = Number(row?.converted ?? 0);
      return { id: executive.id, name: `${executive.firstName} ${executive.lastName}`.trim(), leads, converted, conversionRate: leads ? converted / leads * 100 : 0, orders: Number(row?.orders ?? 0), invoiced: asNumber(row?.invoiced) };
    }).sort((a, b) => b.invoiced - a.invoiced || b.orders - a.orders || b.converted - a.converted || a.name.localeCompare(b.name));
    const companyName = company?.invoiceHeaderName ?? company?.tradeName ?? company?.legalBusinessName ?? "";
    const isDemoData = /demo|test only/i.test(companyName);

    return NextResponse.json({
      generatedAt: now.toISOString(), range: { from: range.from.toISOString(), to: new Date(range.to.getTime() - 1).toISOString() },
      isDemoData,
      kpis: {
        leads: { total: totalLeads, created: newLeads, previousCreated: previousLeads, qualified: qualifiedLeads, converted: convertedLeads, previousConverted: previousConvertedLeads },
        customers: totalCustomers, newCustomers: customers,
        confirmedOrders: orderCounts.CONFIRMED ?? 0,
        invoiced: { amount: invoiced, previousAmount: asNumber(previousInvoiceSummary._sum?.grandTotal), count: invoiceCount },
        collected: { amount: collected, count: payments._count._all },
        outstanding: { amount: asNumber(outstandingSummary._sum?.outstandingAmount), invoices: pendingInvoices },
        creditNotes: { amount: credited, count: creditNotes._count._all },
      },
      crm: { pipeline, priorities, conversionRate: totalLeads ? allConvertedLeads / totalLeads * 100 : 0, trend: [...pointMap.values()].sort((a, b) => a.date.localeCompare(b.date)) },
      orders: orderCounts,
      sales: {
        trend: [...pointMap.values()].filter((point) => point.invoiced || point.leads || point.converted),
        topProducts: topProducts.map((row) => ({ name: row.name, sku: row.sku, quantity: Number(row.quantity), amount: asNumber(row.amount) })),
        executives: executivePerformance,
      },
      inventory: { activeProducts, activeWarehouses, onHand, reserved, blocked, available: onHand - reserved - blocked, lowStock: lowStockRows.map((item) => ({ ...item, available: Number(item.available), reorderLevel: Number(item.reorderLevel) })) },
      followUps: followUps.map((item) => ({ ...item, assignee: actorName(item.assignedTo), overdue: item.dueAt < now, href: `/admin/leads/${item.lead.id}` })),
      activity: activities,
      recent: {
        leads: recentLeads,
        orders: recentOrders.map((item) => ({ ...item, totalAmount: asNumber(item.totalAmount) })),
        invoices: recentInvoices.map((item) => ({ ...item, grandTotal: asNumber(item.grandTotal) })),
      },
    });
  } catch (error) {
    logDashboardFailure("data_load", error, range);
    return NextResponse.json({ error: "Dashboard data could not be loaded." }, { status: isDatabaseUnavailable(error) ? 503 : 500 });
  }
}
