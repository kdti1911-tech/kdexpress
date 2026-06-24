import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

type Params = { params: Promise<{ tracking: string }> };

export default async function LabelPage({ params }: Params) {
  const { tracking } = await params;

  const pkg = await db.shipmentPackage.findUnique({
    where: { trackingNumber: tracking.toUpperCase() },
    include: {
      shipment: {
        select: {
          id: true,
          trackingNumber: true,
          totalPieces: true,
          shipperName: true,
          shipperPhone: true,
          shipperCity: true,
          shipperCountry: true,
          receiverName: true,
          receiverPhone: true,
          receiverAddress: true,
          receiverCity: true,
          receiverProvince: true,
          receiverPostcode: true,
          receiverCountry: true,
          notes: true,
          createdAt: true,
        },
      },
    },
  });

  if (!pkg) notFound();

  const { shipment } = pkg;
  const receiverLocation = [
    shipment.receiverAddress,
    shipment.receiverCity,
    shipment.receiverProvince,
    shipment.receiverPostcode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      {/* Action bar — hidden when printing */}
      <div className="print:hidden bg-gray-100 border-b border-gray-200 px-6 py-3 flex items-center gap-4 no-print">
        <a
          href={`/shipments/${shipment.id}`}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Back to Shipment
        </a>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-500 font-mono">{pkg.trackingNumber}</span>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      {/* Label — centered on screen, fills page when printing */}
      <div className="flex justify-center p-8 print:p-0 bg-white min-h-screen">
        <div
          className="border-2 border-black font-mono text-sm"
          style={{ width: "4in", minHeight: "6in" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b-2 border-black">
            <div>
              <div className="text-xl font-bold tracking-tight">KD EXPRESS</div>
              <div className="text-xs text-gray-500">kdexpress.ca</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-gray-500">Master Tracking</div>
              <div className="font-bold font-mono">{shipment.trackingNumber}</div>
              <div className="mt-1 text-gray-500">
                Piece {pkg.sequence} of {shipment.totalPieces}
              </div>
            </div>
          </div>

          {/* Child tracking barcode area */}
          <div className="px-4 py-5 border-b-2 border-black text-center">
            <div className="text-xs text-gray-500 mb-2 uppercase tracking-widest">
              Piece Tracking Number
            </div>
            <div
              className="text-3xl font-bold tracking-widest leading-none"
              style={{ letterSpacing: "0.15em" }}
            >
              {pkg.trackingNumber}
            </div>
            <div className="mt-3 text-sm font-bold uppercase tracking-wide bg-black text-white px-3 py-1 inline-block">
              {pkg.sequence} / {shipment.totalPieces}
            </div>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 divide-x divide-black border-b-2 border-black">
            <div className="px-3 py-3">
              <div className="text-xs font-bold uppercase text-gray-500 mb-2">From</div>
              <div className="font-bold text-sm leading-snug">{shipment.shipperName}</div>
              {shipment.shipperCity && (
                <div className="text-sm leading-snug">{shipment.shipperCity}</div>
              )}
              <div className="text-sm leading-snug">{shipment.shipperCountry}</div>
              {shipment.shipperPhone && (
                <div className="text-xs text-gray-500 mt-1">{shipment.shipperPhone}</div>
              )}
            </div>
            <div className="px-3 py-3">
              <div className="text-xs font-bold uppercase text-gray-500 mb-2">To</div>
              <div className="font-bold text-sm leading-snug">{shipment.receiverName}</div>
              {receiverLocation && (
                <div className="text-sm leading-snug">{receiverLocation}</div>
              )}
              <div className="text-sm leading-snug">{shipment.receiverCountry}</div>
              {shipment.receiverPhone && (
                <div className="text-xs text-gray-500 mt-1">{shipment.receiverPhone}</div>
              )}
            </div>
          </div>

          {/* Weight / Dimensions */}
          <div className="px-4 py-3 border-b border-gray-300 flex items-center gap-6">
            <div>
              <div className="text-xs text-gray-500 uppercase">Weight</div>
              <div className="font-bold text-lg">{pkg.weight.toFixed(2)} kg</div>
            </div>
            {pkg.length && pkg.width && pkg.height && (
              <div>
                <div className="text-xs text-gray-500 uppercase">Dimensions</div>
                <div className="font-bold">
                  {pkg.length}×{pkg.width}×{pkg.height} cm
                </div>
              </div>
            )}
            {pkg.isFragile && (
              <div className="ml-auto border-2 border-red-600 text-red-600 px-2 py-1 text-xs font-bold uppercase">
                Fragile
              </div>
            )}
            {pkg.isDangerous && (
              <div className="ml-auto border-2 border-orange-600 text-orange-600 px-2 py-1 text-xs font-bold uppercase">
                Danger
              </div>
            )}
          </div>

          {/* Description & notes */}
          {(pkg.description || shipment.notes) && (
            <div className="px-4 py-3 border-b border-gray-300">
              {pkg.description && (
                <div className="text-xs">
                  <span className="text-gray-500 uppercase">Contents: </span>
                  {pkg.description}
                </div>
              )}
              {shipment.notes && (
                <div className="text-xs mt-1">
                  <span className="text-gray-500 uppercase">Note: </span>
                  {shipment.notes}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 text-xs text-gray-400 flex justify-between">
            <span>
              Created:{" "}
              {new Date(shipment.createdAt).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span>{shipment.trackingNumber}</span>
          </div>
        </div>
      </div>
    </>
  );
}
