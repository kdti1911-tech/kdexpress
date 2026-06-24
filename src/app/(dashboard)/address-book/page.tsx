import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function AddressBookPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const addresses = await db.addressBook.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Address Book</h1>
          <p className="text-sm text-gray-500 mt-0.5">{addresses.length} saved addresses</p>
        </div>
        <Link
          href="/address-book/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Address
        </Link>
      </div>

      {addresses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-4xl mb-3">📋</div>
          <div className="text-gray-600 font-medium">No saved addresses yet</div>
          <div className="text-gray-400 text-sm mt-1">Add addresses for frequently used shippers or receivers</div>
          <Link href="/address-book/new" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Add your first address →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  addr.type === "shipper" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                }`}>
                  {addr.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{addr.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      addr.type === "shipper" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                    }`}>
                      {addr.type}
                    </span>
                    {addr.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">Default</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {[addr.phone, addr.email].filter(Boolean).join(" · ")}
                  </div>
                  <div className="text-sm text-gray-500">
                    {[addr.address, addr.city, addr.province, addr.postcode, addr.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Added {formatDate(addr.createdAt)}</div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/address-book/${addr.id}/edit`}
                  className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded px-2 py-1 transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
