import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type Params = { params: Promise<{ id: string }> };

export default async function CustomsInvoicePage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const shipment = await db.shipment.findUnique({
    where: { id },
    include: { packages: { orderBy: { sequence: "asc" } } },
  });
  if (!shipment) notFound();
  const isClient = ["CLIENT", "AGENT", "AGENT_VN"].includes(user.role);
  if (isClient && shipment.senderId !== user.id) notFound();

  const totalValue = shipment.packages.reduce((s, p) => s + (p.value ?? 0), 0);

  return (
    <>
      <div className="print:hidden bg-gray-100 border-b px-6 py-3 flex items-center gap-4">
        <Link href={`/shipments/${id}`} className="text-sm text-gray-600 hover:text-gray-900">← Back</Link>
        <span className="text-sm text-gray-500">Customs Invoice</span>
        <button className="ml-auto bg-blue-600 text-white text-sm px-4 py-2 rounded-lg" id="print-btn2">Print</button>
        <script dangerouslySetInnerHTML={{ __html: "document.getElementById('print-btn2').onclick=()=>window.print()" }} />
      </div>

      <div className="max-w-3xl mx-auto p-8 print:p-4 bg-white min-h-screen font-sans text-sm">
        <div className="text-center mb-6">
          <div className="text-xl font-bold">CUSTOMS INVOICE / KHAI BÁO HẢI QUAN</div>
          <div className="text-gray-500 mt-1">KD Express · kdexpress.ca</div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 border border-gray-300 p-4">
          <div>
            <div className="font-bold text-xs uppercase text-gray-400 mb-1">Shipper / Người Gửi</div>
            <div className="font-semibold">{shipment.shipperName}</div>
            {shipment.shipperAddress && <div>{shipment.shipperAddress}</div>}
            <div>{[shipment.shipperCity, shipment.shipperProvince, shipment.shipperPostcode].filter(Boolean).join(", ")}</div>
            <div>{shipment.shipperCountry}</div>
            {shipment.shipperPhone && <div>{shipment.shipperPhone}</div>}
          </div>
          <div>
            <div className="font-bold text-xs uppercase text-gray-400 mb-1">Consignee / Người Nhận</div>
            <div className="font-semibold">{shipment.receiverName}</div>
            {shipment.receiverAddress && <div>{shipment.receiverAddress}</div>}
            <div>{[shipment.receiverCity, shipment.receiverProvince, shipment.receiverPostcode].filter(Boolean).join(", ")}</div>
            <div>{shipment.receiverCountry}</div>
            {shipment.receiverPhone && <div>{shipment.receiverPhone}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6 border border-gray-300 p-3 text-xs">
          <div><span className="text-gray-400">AWB/Tracking:</span><br/><strong className="font-mono">{shipment.trackingNumber}</strong></div>
          <div><span className="text-gray-400">Date / Ngày:</span><br/>{formatDate(shipment.createdAt)}</div>
          <div><span className="text-gray-400">Total Weight / Tổng KG:</span><br/><strong>{shipment.totalWeight.toFixed(2)} kg</strong></div>
        </div>

        <table className="w-full border-collapse border border-gray-300 mb-6 text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">#</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Description / Mô tả hàng hoá</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Qty</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Weight / KG</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Unit Value / Giá trị</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Origin / Xuất xứ</th>
            </tr>
          </thead>
          <tbody>
            {shipment.packages.map((pkg) => (
              <tr key={pkg.id}>
                <td className="border border-gray-300 px-3 py-2">{pkg.sequence}</td>
                <td className="border border-gray-300 px-3 py-2">{pkg.description || "Personal effects / Đồ dùng cá nhân"}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">1</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{pkg.weight.toFixed(2)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right">{pkg.value ? `CAD ${pkg.value.toFixed(2)}` : "CAD 0.00"}</td>
                <td className="border border-gray-300 px-3 py-2">Canada</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td colSpan={4} className="border border-gray-300 px-3 py-2 text-right">TOTAL / TỔNG CỘNG:</td>
              <td className="border border-gray-300 px-3 py-2 text-right">CAD {totalValue.toFixed(2)}</td>
              <td className="border border-gray-300 px-3 py-2"></td>
            </tr>
          </tbody>
        </table>

        <div className="text-xs text-gray-500 mb-6">
          <p>I/We hereby certify that the information on this invoice is true and correct and that the contents and values declared are for customs purposes only.</p>
          <p className="mt-1">Tôi/Chúng tôi xác nhận rằng thông tin trên hóa đơn này là đúng sự thật và các mặt hàng và giá trị khai báo chỉ dành cho mục đích hải quan.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mt-8">
          <div className="border-t border-gray-400 pt-2 text-xs text-gray-500">
            <div>Shipper Signature / Chữ ký người gửi</div>
            <div className="mt-6">Date / Ngày: {formatDate(shipment.createdAt)}</div>
          </div>
          <div className="border-t border-gray-400 pt-2 text-xs text-gray-500">
            <div>Authorized by / Xác nhận bởi: KD Express</div>
          </div>
        </div>
      </div>
    </>
  );
}
