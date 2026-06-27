import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

interface Props {
  searchParams: Promise<{ ids?: string }>;
}

export default async function BulkLabelPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const ids = (params.ids ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) redirect("/shipments");

  const packages = await db.shipmentPackage.findMany({
    where: { shipment: { id: { in: ids } } },
    orderBy: [{ shipmentId: "asc" }, { sequence: "asc" }],
    include: {
      shipment: {
        select: {
          trackingNumber: true,
          totalPieces: true,
          shipperName: true,
          receiverName: true,
          receiverCity: true,
          receiverCountry: true,
          notes: true,
          destBranch: { select: { name: true } },
        },
      },
    },
  });

  const labelsWithQR = await Promise.all(
    packages.map(async pkg => {
      const qrDataUrl = await QRCode.toDataURL(pkg.trackingNumber ?? "", {
        width: 180,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return { pkg, qrDataUrl };
    })
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: 4in 6in; margin: 0; }
          body { margin: 0; }
          .no-print { display: none !important; }
          .label-page { page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: avoid; break-after: avoid; }
        }
      `}</style>

      <div className="no-print bg-gray-100 border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <a href="/shipments" className="text-sm text-gray-600 hover:text-gray-900">← Back</a>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-700">
          {labelsWithQR.length} label{labelsWithQR.length !== 1 ? "s" : ""} — {ids.length} shipment{ids.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800"
          suppressHydrationWarning
        >
          Print All
        </button>
      </div>

      <div className="bg-gray-200 min-h-screen print:bg-white print:min-h-0">
        {labelsWithQR.map(({ pkg, qrDataUrl }) => {
          const { shipment } = pkg;
          const trackingDisplay = (pkg.trackingNumber ?? "").replace(/-/g, "");
          const masterDisplay = shipment.trackingNumber.replace(/-/g, "");
          const destination =
            shipment.destBranch?.name ??
            [shipment.receiverCity, shipment.receiverCountry].filter(Boolean).join(", ");

          return (
            <div key={pkg.id} className="label-page flex justify-center py-8 print:py-0">
              <div
                className="bg-white border-2 border-black font-sans flex flex-col"
                style={{ width: "4in", height: "6in" }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b-2 border-black">
                  <div>
                    <div className="text-lg font-black tracking-tight leading-none">KD EXPRESS</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">kdexpress.ca</div>
                  </div>
                  <div className="text-right text-[10px]">
                    <div className="font-bold text-gray-500">Kiện {pkg.sequence} / {shipment.totalPieces}</div>
                    <div className="font-mono text-[9px] text-gray-400">{masterDisplay}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 px-3 py-3 border-b-2 border-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt={trackingDisplay} width={110} height={110} className="flex-shrink-0" />
                  <div className="flex-1 text-center">
                    <div className="text-[9px] text-gray-400 uppercase tracking-widest mb-1">Mã Vận Đơn</div>
                    <div className="text-[22px] font-black leading-tight break-all font-mono" style={{ letterSpacing: "0.04em" }}>
                      {trackingDisplay}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x-2 divide-black border-b-2 border-black">
                  <div className="px-3 py-2">
                    <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Người Gửi</div>
                    <div className="font-bold text-sm leading-snug">{shipment.shipperName}</div>
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Người Nhận</div>
                    <div className="font-bold text-sm leading-snug">{shipment.receiverName}</div>
                  </div>
                </div>

                <div className="px-3 py-2 border-b-2 border-black">
                  <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Destination</div>
                  <div className="text-base font-black leading-snug">{destination || shipment.receiverCountry}</div>
                </div>

                <div className="px-3 py-2 border-b-2 border-black flex gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Trọng Lượng</div>
                    <div className="text-xl font-black">{pkg.weight.toFixed(2)} <span className="text-sm font-bold">kg</span></div>
                  </div>
                  {shipment.notes && (
                    <div className="flex-1">
                      <div className="text-[9px] font-black uppercase text-gray-400 mb-1">Lưu Ý</div>
                      <div className="text-xs leading-snug">{shipment.notes}</div>
                    </div>
                  )}
                </div>

                <div className="mt-auto px-3 py-2 border-t border-gray-300 bg-gray-50">
                  <p className="text-[8.5px] leading-[1.45] text-gray-700">
                    <span className="font-black">Lưu Ý!</span> Quý khách vui lòng kiểm hàng ngay khi nhận hàng. Nếu thấy thùng hoặc niêm phong có dấu hiệu bất thường, xin yêu cầu nhân viên giao hàng lập biên bản ngay để được giải quyết mọi khiếu nại.
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
