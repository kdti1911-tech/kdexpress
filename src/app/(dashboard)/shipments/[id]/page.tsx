import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
  TRANSPORT_MODE_LABELS,
  PAYMENT_METHOD_LABELS,
  HAZARD_TYPE_LABELS,
  DELIVERY_METHOD_LABELS,
  TRUCK_VENDOR_LABELS,
} from "@/lib/utils";
import UpdateStatusForm from "@/components/UpdateStatusForm";

type Params = { params: Promise<{ id: string }> };

export default async function ShipmentDetailPage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const shipment = await db.shipment.findUnique({
    where: { id },
    include: {
      packages: { orderBy: { sequence: "asc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
      surcharges: { include: { surcharge: true } },
      customFields: { include: { field: true } },
      sender: { select: { id: true, name: true, email: true, phone: true, userCode: true } },
      originBranch: { select: { id: true, name: true, code: true } },
      destBranch: { select: { id: true, name: true, code: true } },
    },
  });

  if (!shipment) notFound();

  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(user.role);
  if (isClient && shipment.senderId !== user.id) notFound();

  const canUpdate = !isClient;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/shipments" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Shipments
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-green-700 font-semibold">{shipment.trackingNumber}</span>
        <span
          className={`ml-auto text-xs font-medium px-3 py-1 rounded-full ${
            SHIPMENT_STATUS_COLORS[shipment.status] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {SHIPMENT_STATUS_LABELS[shipment.status]}
        </span>
        {/* Action links */}
        <div className="flex gap-2 mt-4">
          <Link
            href={`/shipments/${shipment.id}/invoice`}
            target="_blank"
            className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            🖨 Invoice
          </Link>
          <Link
            href={`/shipments/${shipment.id}/customs-invoice`}
            target="_blank"
            className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            📋 Customs Invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-5">
          {/* Shipper / Receiver */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Shipment Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Shipper (From)</div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-gray-900">{shipment.shipperName}</div>
                  {shipment.shipperPhone && <div className="text-gray-600">{shipment.shipperPhone}</div>}
                  {shipment.shipperEmail && <div className="text-gray-600">{shipment.shipperEmail}</div>}
                  {shipment.shipperAddress && <div className="text-gray-500">{shipment.shipperAddress}</div>}
                  <div className="text-gray-500">
                    {[shipment.shipperCity, shipment.shipperProvince, shipment.shipperPostcode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div className="text-gray-500">{shipment.shipperCountry}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Receiver (To)</div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-gray-900">{shipment.receiverName}</div>
                  {shipment.receiverPhone && <div className="text-gray-600">{shipment.receiverPhone}</div>}
                  {shipment.receiverEmail && <div className="text-gray-600">{shipment.receiverEmail}</div>}
                  {shipment.receiverAddress && <div className="text-gray-500">{shipment.receiverAddress}</div>}
                  <div className="text-gray-500">
                    {[shipment.receiverCity, shipment.receiverProvince, shipment.receiverPostcode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div className="text-gray-500">{shipment.receiverCountry}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Packages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">
              Packages ({shipment.totalPieces} pcs · {shipment.totalWeight.toFixed(2)} kg)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs text-gray-400 font-medium">#</th>
                    <th className="text-left py-2 text-xs text-gray-400 font-medium">Piece Tracking</th>
                    <th className="text-left py-2 text-xs text-gray-400 font-medium">Description</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-medium">Weight</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-medium">Dimensions</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-medium">Value</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {shipment.packages.map((pkg) => (
                    <tr key={pkg.id}>
                      <td className="py-2 text-gray-400">{pkg.sequence}</td>
                      <td className="py-2">
                        {pkg.trackingNumber ? (
                          <span className="font-mono text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            {pkg.trackingNumber}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2 text-gray-700">{pkg.description || "—"}</td>
                      <td className="py-2 text-right text-gray-900">{pkg.weight.toFixed(2)} kg</td>
                      <td className="py-2 text-right text-gray-500">
                        {pkg.length && pkg.width && pkg.height
                          ? `${pkg.length}×${pkg.width}×${pkg.height} cm`
                          : "—"}
                      </td>
                      <td className="py-2 text-right text-gray-500">
                        {pkg.value ? formatCurrency(pkg.value) : "—"}
                      </td>
                      <td className="py-2 pl-3">
                        {pkg.trackingNumber && (
                          <Link
                            href={`/label/${pkg.trackingNumber}`}
                            target="_blank"
                            className="text-xs text-gray-500 hover:text-green-700 hover:bg-green-50 border border-gray-200 rounded px-2 py-1 whitespace-nowrap transition-colors"
                          >
                            🖨 Label
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status History */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Tracking History</h2>
            <div className="space-y-0">
              {shipment.statusHistory.map((h, i) => (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                        i === shipment.statusHistory.length - 1
                          ? "bg-green-600"
                          : "bg-gray-300"
                      }`}
                    />
                    {i < shipment.statusHistory.length - 1 && (
                      <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <div className="text-sm font-medium text-gray-900">
                      {SHIPMENT_STATUS_LABELS[h.status] ?? h.status}
                    </div>
                    {h.note && <div className="text-sm text-gray-600">{h.note}</div>}
                    {h.location && (
                      <div className="text-xs text-gray-400">{h.location}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(h.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {canUpdate && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <UpdateStatusForm shipmentId={shipment.id} currentStatus={shipment.status} />
              </div>
            )}
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-5">
          {/* Pricing */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Pricing</h2>
            <div className="space-y-2 text-sm">
              <Row label="Base Rate" value={formatCurrency(shipment.baseRate, shipment.currency)} />
              <Row label="Fuel Surcharge" value={formatCurrency(shipment.fuelSurcharge, shipment.currency)} />
              {shipment.insuranceAmount > 0 && (
                <Row label="Insurance" value={formatCurrency(shipment.insuranceAmount, shipment.currency)} />
              )}
              {shipment.surchargesTotal > 0 && (
                <Row label="Surcharges" value={formatCurrency(shipment.surchargesTotal, shipment.currency)} />
              )}
              <div className="pt-2 border-t border-gray-100">
                <Row
                  label="Total"
                  value={formatCurrency(shipment.totalAmount, shipment.currency)}
                  bold
                />
              </div>
              <div className="pt-1">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    shipment.paymentStatus === "PAID"
                      ? "bg-green-100 text-green-700"
                      : shipment.paymentStatus === "PARTIAL"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {shipment.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Info</h2>
            <div className="space-y-3 text-sm">
              <InfoRow label="Type" value={shipment.shipmentType} />
              <InfoRow label="Created" value={formatDate(shipment.createdAt)} />
              {shipment.pickupDate && (
                <InfoRow label="Pickup" value={formatDate(shipment.pickupDate)} />
              )}
              {shipment.expectedDelivery && (
                <InfoRow label="Expected" value={formatDate(shipment.expectedDelivery)} />
              )}
              {shipment.deliveredAt && (
                <InfoRow label="Delivered" value={formatDateTime(shipment.deliveredAt)} />
              )}
              {shipment.originBranch && (
                <InfoRow label="Origin Branch" value={shipment.originBranch.name} />
              )}
              {shipment.destBranch && (
                <InfoRow label="Dest Branch" value={shipment.destBranch.name} />
              )}
              {shipment.carrierName && (
                <InfoRow label="Carrier" value={shipment.carrierName} />
              )}
              {shipment.carrierTrackNum && (
                <InfoRow label="Carrier Track #" value={shipment.carrierTrackNum} />
              )}
              {!isClient && shipment.sender && (
                <InfoRow
                  label="Customer"
                  value={`${shipment.sender.name}${shipment.sender.userCode ? ` [${shipment.sender.userCode}]` : ""}`}
                />
              )}
              {shipment.transportMode && (
                <InfoRow label="Transport Mode" value={TRANSPORT_MODE_LABELS[shipment.transportMode] ?? shipment.transportMode} />
              )}
              {shipment.paymentMethod && (
                <InfoRow label="Payment Method" value={PAYMENT_METHOD_LABELS[shipment.paymentMethod] ?? shipment.paymentMethod} />
              )}
              {shipment.hazardType && shipment.hazardType !== "NONE" && (
                <InfoRow label="Lưu Ý / Hazard" value={HAZARD_TYPE_LABELS[shipment.hazardType] ?? shipment.hazardType} />
              )}
              {shipment.deliveryMethod && (
                <InfoRow label="Delivery" value={DELIVERY_METHOD_LABELS[shipment.deliveryMethod] ?? shipment.deliveryMethod} />
              )}
              {shipment.truckVendor && (
                <InfoRow label="Truck Vendor" value={TRUCK_VENDOR_LABELS[shipment.truckVendor] ?? shipment.truckVendor} />
              )}
              {shipment.truckCost && shipment.truckCost > 0 && (
                <InfoRow label="Truck Cost" value={formatCurrency(shipment.truckCost)} />
              )}
              {shipment.chargeableWeight && shipment.chargeableWeight > 0 && (
                <InfoRow label="Chargeable Weight" value={`${shipment.chargeableWeight.toFixed(2)} kg`} />
              )}
              {shipment.dimensionalWeight && shipment.dimensionalWeight > 0 && (
                <InfoRow label="Dim Weight" value={`${shipment.dimensionalWeight.toFixed(2)} kg`} />
              )}
              {shipment.shipmentCategory && (
                <InfoRow label="Category" value={shipment.shipmentCategory} />
              )}
              {shipment.marketingTracker && (
                <InfoRow label="Source" value={shipment.marketingTracker} />
              )}
            </div>
          </div>

          {/* Notes */}
          {(shipment.notes || (canUpdate && shipment.internalNotes)) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
              {shipment.notes && (
                <div className="text-sm text-gray-600 mb-2">{shipment.notes}</div>
              )}
              {canUpdate && shipment.internalNotes && (
                <div className="text-sm text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg p-3">
                  <div className="text-xs font-medium text-yellow-700 mb-1">Internal</div>
                  {shipment.internalNotes}
                </div>
              )}
            </div>
          )}

          {/* Label */}
          {shipment.labelUrl && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Shipping Label</h2>
              <a
                href={shipment.labelUrl}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm text-green-700 hover:underline"
              >
                Download Label →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-bold text-gray-900" : "text-gray-900"}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-gray-900">{value}</div>
    </div>
  );
}
