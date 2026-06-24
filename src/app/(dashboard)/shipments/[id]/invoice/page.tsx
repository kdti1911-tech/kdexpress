import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, formatDate, TRANSPORT_MODE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import Link from "next/link";

type Params = { params: Promise<{ id: string }> };

export default async function InvoicePage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const shipment = await db.shipment.findUnique({
    where: { id },
    include: {
      packages: { orderBy: { sequence: "asc" } },
      surcharges: { include: { surcharge: true } },
      originBranch: true,
    },
  });

  if (!shipment) notFound();
  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(user.role);
  if (isClient && shipment.senderId !== user.id) notFound();

  // Invoice number = tracking number
  const invoiceNum = shipment.trackingNumber;

  return (
    <>
      <div className="print:hidden bg-gray-100 border-b px-6 py-3 flex items-center gap-4">
        <Link href={`/shipments/${id}`} className="text-sm text-gray-600 hover:text-gray-900">← Back</Link>
        <span className="text-sm text-gray-500">Invoice {invoiceNum}</span>
        <button onClick={undefined} className="ml-auto bg-blue-600 text-white text-sm px-4 py-2 rounded-lg print:hidden" id="print-btn">Print</button>
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print-btn').onclick=()=>window.print()" }} />
      </div>

      <div className="max-w-3xl mx-auto p-8 print:p-4 bg-white min-h-screen font-sans">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-900">
          <div>
            <div className="text-2xl font-bold text-gray-900">KD EXPRESS</div>
            <div className="text-sm text-gray-500 mt-1">
              {shipment.originBranch ? (
                <>
                  <div>{shipment.originBranch.address1}</div>
                  <div>{[shipment.originBranch.city, shipment.originBranch.province, shipment.originBranch.postcode].filter(Boolean).join(", ")}</div>
                  <div>{shipment.originBranch.phone}</div>
                </>
              ) : (
                <>
                  <div>2781 Thamesgate Drive</div>
                  <div>Mississauga, ON L4T 1G5</div>
                  <div>+1 437 989 1171</div>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-gray-900">INVOICE</div>
            <div className="font-mono text-sm text-gray-600 mt-1">#{invoiceNum}</div>
            <div className="text-sm text-gray-500 mt-1">Date: {formatDate(shipment.createdAt)}</div>
            <div className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full inline-block ${
              shipment.paymentStatus === "PAID" ? "bg-green-100 text-green-700" :
              shipment.paymentStatus === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {shipment.paymentStatus}
            </div>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Bill To / Người Gửi</div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold text-gray-900">{shipment.shipperName}</div>
              {shipment.shipperPhone && <div className="text-gray-600">{shipment.shipperPhone}</div>}
              {shipment.shipperEmail && <div className="text-gray-600">{shipment.shipperEmail}</div>}
              {shipment.shipperAddress && <div className="text-gray-600">{shipment.shipperAddress}</div>}
              <div className="text-gray-600">
                {[shipment.shipperCity, shipment.shipperProvince, shipment.shipperPostcode].filter(Boolean).join(", ")}
              </div>
              <div className="text-gray-600">{shipment.shipperCountry}</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Ship To / Người Nhận</div>
            <div className="text-sm space-y-0.5">
              <div className="font-semibold text-gray-900">{shipment.receiverName}</div>
              {shipment.receiverPhone && <div className="text-gray-600">{shipment.receiverPhone}</div>}
              {shipment.receiverEmail && <div className="text-gray-600">{shipment.receiverEmail}</div>}
              {shipment.receiverAddress && <div className="text-gray-600">{shipment.receiverAddress}</div>}
              <div className="text-gray-600">
                {[shipment.receiverCity, shipment.receiverProvince, shipment.receiverPostcode].filter(Boolean).join(", ")}
              </div>
              <div className="text-gray-600">{shipment.receiverCountry}</div>
            </div>
          </div>
        </div>

        {/* Shipment details bar */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 mb-6 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 text-xs uppercase">Tracking #</span>
            <div className="font-mono font-semibold">{shipment.trackingNumber}</div>
          </div>
          {shipment.transportMode && (
            <div>
              <span className="text-gray-400 text-xs uppercase">Mode</span>
              <div>{TRANSPORT_MODE_LABELS[shipment.transportMode] ?? shipment.transportMode}</div>
            </div>
          )}
          {shipment.paymentMethod && (
            <div>
              <span className="text-gray-400 text-xs uppercase">Payment</span>
              <div>{PAYMENT_METHOD_LABELS[shipment.paymentMethod] ?? shipment.paymentMethod}</div>
            </div>
          )}
        </div>

        {/* Packages table */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 text-xs uppercase text-gray-500">#</th>
              <th className="text-left py-2 text-xs uppercase text-gray-500">Description</th>
              <th className="text-right py-2 text-xs uppercase text-gray-500">Weight</th>
              <th className="text-right py-2 text-xs uppercase text-gray-500">Dimensions</th>
              <th className="text-right py-2 text-xs uppercase text-gray-500">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shipment.packages.map((pkg) => (
              <tr key={pkg.id}>
                <td className="py-2 text-gray-400">{pkg.sequence}</td>
                <td className="py-2">{pkg.description || "General Cargo"}</td>
                <td className="py-2 text-right">{pkg.weight.toFixed(2)} kg</td>
                <td className="py-2 text-right text-gray-500">
                  {pkg.length && pkg.width && pkg.height ? `${pkg.length}×${pkg.width}×${pkg.height} cm` : "—"}
                </td>
                <td className="py-2 text-right text-gray-500">
                  {pkg.value ? formatCurrency(pkg.value) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Charges */}
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Freight ({shipment.totalWeight.toFixed(2)} kg)</span>
            <span>{formatCurrency(shipment.baseRate, shipment.currency)}</span>
          </div>
          {shipment.fuelSurcharge > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fuel Surcharge</span>
              <span>{formatCurrency(shipment.fuelSurcharge, shipment.currency)}</span>
            </div>
          )}
          {shipment.insuranceAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Insurance (6%)</span>
              <span>{formatCurrency(shipment.insuranceAmount, shipment.currency)}</span>
            </div>
          )}
          {shipment.surcharges.map((ss) => (
            <div key={ss.surchargeId} className="flex justify-between text-sm">
              <span className="text-gray-600">{ss.surcharge.item}</span>
              <span>{formatCurrency(ss.amount || ss.surcharge.cost, shipment.currency)}</span>
            </div>
          ))}
          {shipment.truckCost && shipment.truckCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Truck / {shipment.truckVendor ?? "Logistics"}</span>
              <span>{formatCurrency(shipment.truckCost, shipment.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-gray-300 pt-2 mt-2">
            <span>TOTAL</span>
            <span>{formatCurrency(shipment.totalAmount, shipment.currency)}</span>
          </div>
        </div>

        {/* Notes */}
        {shipment.notes && (
          <div className="mt-6 pt-4 border-t border-gray-100 text-sm text-gray-600">
            <span className="font-semibold">Notes: </span>{shipment.notes}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          Thank you for shipping with KD Express · kdexpress.ca
        </div>
      </div>
    </>
  );
}
