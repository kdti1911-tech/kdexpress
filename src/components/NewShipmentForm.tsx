"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CANADA_PROVINCES, VIETNAM_PROVINCES, formatCurrency } from "@/lib/utils";

type Location = { id: string; name: string; slug: string };
type Branch = { id: string; name: string; code: string };
type Surcharge = { id: string; item: string; cost: number; costType: string };
type Package = {
  description: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  value: string;
  isFragile: boolean;
};

type Rate = {
  rateId: string;
  deliveryTypeId: string;
  deliveryTypeTitle: string;
  brand: string | null;
  service: string | null;
  baseRate: number;
  fuelSurcharge: number;
  insuranceAmount: number;
  totalAmount: number;
  currency: string;
  logoUrl: string | null;
};

interface Props {
  locations: Location[];
  branches: Branch[];
  surcharges: Surcharge[];
  userBranchId?: string | null;
}

const EMPTY_PACKAGE: Package = {
  description: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  value: "",
  isFragile: false,
};

export default function NewShipmentForm({ locations, branches, surcharges, userBranchId }: Props) {
  const router = useRouter();

  // Shipper
  const [shipperName, setShipperName] = useState("");
  const [shipperPhone, setShipperPhone] = useState("");
  const [shipperEmail, setShipperEmail] = useState("");
  const [shipperAddress, setShipperAddress] = useState("");
  const [shipperCity, setShipperCity] = useState("");
  const [shipperProvince, setShipperProvince] = useState("ON");
  const [shipperPostcode, setShipperPostcode] = useState("");
  const [shipperCountry, setShipperCountry] = useState("CA");

  // Receiver
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [receiverCity, setReceiverCity] = useState("");
  const [receiverProvince, setReceiverProvince] = useState("");
  const [receiverPostcode, setReceiverPostcode] = useState("");
  const [receiverCountry, setReceiverCountry] = useState("VN");

  // Packages
  const [packages, setPackages] = useState<Package[]>([{ ...EMPTY_PACKAGE }]);

  // Rate
  const [originLocationId, setOriginLocationId] = useState(locations[0]?.id ?? "");
  const [destLocationId, setDestLocationId] = useState(locations.find(l => l.slug.includes("vietnam"))?.id ?? locations[1]?.id ?? "");
  const [insuranceValue, setInsuranceValue] = useState("0");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [calculatingRates, setCalculatingRates] = useState(false);
  const [rateError, setRateError] = useState("");

  // Other
  const [selectedSurcharges, setSelectedSurcharges] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [originBranchId, setOriginBranchId] = useState(userBranchId ?? "");
  const [pickupDate, setPickupDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const totalWeight = packages.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0);

  function addPackage() {
    setPackages([...packages, { ...EMPTY_PACKAGE }]);
  }

  function removePackage(i: number) {
    if (packages.length === 1) return;
    setPackages(packages.filter((_, idx) => idx !== i));
  }

  function updatePackage(i: number, field: keyof Package, value: string | boolean) {
    const updated = [...packages];
    updated[i] = { ...updated[i], [field]: value };
    setPackages(updated);
  }

  async function handleCalculateRates() {
    if (!originLocationId || !destLocationId) {
      setRateError("Select origin and destination locations");
      return;
    }
    if (totalWeight <= 0) {
      setRateError("Add at least one package with weight");
      return;
    }
    setRateError("");
    setCalculatingRates(true);
    setRates([]);
    setSelectedRate(null);

    try {
      const res = await fetch("/api/rates/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLocationId,
          destLocationId,
          weight: totalWeight,
          packages: packages.map((p) => ({
            weight: parseFloat(p.weight) || 0,
            length: parseFloat(p.length) || undefined,
            width: parseFloat(p.width) || undefined,
            height: parseFloat(p.height) || undefined,
          })),
          insuranceValue: parseFloat(insuranceValue) || 0,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setRateError(data.error ?? "Rate calculation failed");
        return;
      }
      setRates(data.data);
      if (data.data.length === 0) {
        setRateError("No rates available for this route");
      }
    } catch {
      setRateError("Network error");
    } finally {
      setCalculatingRates(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setValidationErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipperName,
          shipperPhone,
          shipperEmail,
          shipperAddress,
          shipperCity,
          shipperProvince,
          shipperPostcode,
          shipperCountry,
          receiverName,
          receiverPhone,
          receiverEmail,
          receiverAddress,
          receiverCity,
          receiverProvince,
          receiverPostcode,
          receiverCountry,
          packages: packages.map((p) => ({
            description: p.description || undefined,
            weight: parseFloat(p.weight) || 0,
            length: parseFloat(p.length) || undefined,
            width: parseFloat(p.width) || undefined,
            height: parseFloat(p.height) || undefined,
            value: parseFloat(p.value) || undefined,
            isFragile: p.isFragile,
          })),
          rateId: selectedRate?.rateId,
          deliveryTypeId: selectedRate?.deliveryTypeId,
          baseRate: selectedRate?.baseRate ?? 0,
          fuelSurcharge: selectedRate?.fuelSurcharge ?? 0,
          insuranceAmount: selectedRate?.insuranceAmount ?? 0,
          insuranceValue: parseFloat(insuranceValue) || 0,
          surchargeIds: selectedSurcharges,
          notes: notes || undefined,
          originBranchId: originBranchId || undefined,
          pickupDate: pickupDate || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to create shipment");
        if (data.details && Array.isArray(data.details)) {
          const fieldErrors: Record<string, string> = {};
          for (const err of data.details) {
            const path = Array.isArray(err.path) ? err.path.join(".") : String(err.path ?? "unknown");
            fieldErrors[path] = err.message;
          }
          setValidationErrors(fieldErrors);
        }
        return;
      }
      router.push(`/shipments/${data.data.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Addresses */}
      <div className="grid grid-cols-2 gap-5">
        {/* Shipper */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Shipper (From)</h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={shipperName} onChange={e => setShipperName(e.target.value)} required className={inputCls} placeholder="John Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input value={shipperPhone} onChange={e => setShipperPhone(e.target.value)} className={inputCls} placeholder="+1 416 555 0000" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={shipperEmail} onChange={e => setShipperEmail(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={shipperAddress} onChange={e => setShipperAddress(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input value={shipperCity} onChange={e => setShipperCity(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={shipperCountry} onChange={e => setShipperCountry(e.target.value)} className={inputCls}>
                  <option value="CA">Canada</option>
                  <option value="VN">Vietnam</option>
                  <option value="US">United States</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Province/State</label>
                {shipperCountry === "CA" ? (
                  <select value={shipperProvince} onChange={e => setShipperProvince(e.target.value)} className={inputCls}>
                    {CANADA_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                  </select>
                ) : (
                  <input value={shipperProvince} onChange={e => setShipperProvince(e.target.value)} className={inputCls} />
                )}
              </div>
              <div>
                <label className={labelCls}>Postal Code</label>
                <input value={shipperPostcode} onChange={e => setShipperPostcode(e.target.value)} className={inputCls} placeholder="M5H 2N2" />
              </div>
            </div>
          </div>
        </div>

        {/* Receiver */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Receiver (To)</h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={receiverName} onChange={e => setReceiverName(e.target.value)} required className={inputCls} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} className={inputCls} placeholder="+84 90 000 0000" />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={receiverEmail} onChange={e => setReceiverEmail(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input value={receiverAddress} onChange={e => setReceiverAddress(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input value={receiverCity} onChange={e => setReceiverCity(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <select value={receiverCountry} onChange={e => setReceiverCountry(e.target.value)} className={inputCls}>
                  <option value="VN">Vietnam</option>
                  <option value="CA">Canada</option>
                  <option value="US">United States</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Province</label>
                {receiverCountry === "VN" ? (
                  <select value={receiverProvince} onChange={e => setReceiverProvince(e.target.value)} className={inputCls}>
                    <option value="">Select province</option>
                    {VIETNAM_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : (
                  <input value={receiverProvince} onChange={e => setReceiverProvince(e.target.value)} className={inputCls} />
                )}
              </div>
              <div>
                <label className={labelCls}>Postal Code</label>
                <input value={receiverPostcode} onChange={e => setReceiverPostcode(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Packages</h2>
          <button type="button" onClick={addPackage} className="text-sm text-blue-600 hover:underline">
            + Add package
          </button>
        </div>
        <div className="space-y-4">
          {packages.map((pkg, i) => (
            <div key={i} className="grid grid-cols-8 gap-2 items-end border-b border-gray-100 pb-4">
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <input value={pkg.description} onChange={e => updatePackage(i, "description", e.target.value)} className={inputCls} placeholder="Contents" />
              </div>
              <div>
                <label className={labelCls}>Weight (kg) *</label>
                <input type="number" step="0.01" min="0.01" value={pkg.weight} onChange={e => updatePackage(i, "weight", e.target.value)} required className={inputCls} placeholder="2.5" />
              </div>
              <div>
                <label className={labelCls}>L (cm)</label>
                <input type="number" step="0.1" value={pkg.length} onChange={e => updatePackage(i, "length", e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>W (cm)</label>
                <input type="number" step="0.1" value={pkg.width} onChange={e => updatePackage(i, "width", e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>H (cm)</label>
                <input type="number" step="0.1" value={pkg.height} onChange={e => updatePackage(i, "height", e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Value (CAD)</label>
                <input type="number" step="0.01" min="0" value={pkg.value} onChange={e => updatePackage(i, "value", e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={pkg.isFragile} onChange={e => updatePackage(i, "isFragile", e.target.checked)} className="rounded" />
                  Fragile
                </label>
                {packages.length > 1 && (
                  <button type="button" onClick={() => removePackage(i)} className="text-red-500 hover:text-red-700 text-xs ml-auto">Remove</button>
                )}
              </div>
            </div>
          ))}
          <div className="text-sm text-gray-500">
            Total: <strong>{totalWeight.toFixed(2)} kg</strong> · {packages.length} piece(s)
          </div>
        </div>
      </div>

      {/* Rate Calculator */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Shipping Rate</h2>
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div>
            <label className={labelCls}>Origin Location</label>
            <select value={originLocationId} onChange={e => setOriginLocationId(e.target.value)} className={inputCls}>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Destination</label>
            <select value={destLocationId} onChange={e => setDestLocationId(e.target.value)} className={inputCls}>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Insurance Value (CAD)</label>
            <input type="number" step="0.01" min="0" value={insuranceValue} onChange={e => setInsuranceValue(e.target.value)} className={inputCls} placeholder="0" />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleCalculateRates}
              disabled={calculatingRates || totalWeight <= 0}
              className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {calculatingRates ? "Calculating..." : "Calculate Rates"}
            </button>
          </div>
        </div>

        {rateError && <div className="text-sm text-red-600 mb-3">{rateError}</div>}

        {rates.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Select a rate:</div>
            {rates.map((rate) => (
              <label
                key={rate.rateId}
                className={`flex items-center gap-4 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedRate?.rateId === rate.rateId
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300"
                }`}
              >
                <input
                  type="radio"
                  name="rate"
                  checked={selectedRate?.rateId === rate.rateId}
                  onChange={() => setSelectedRate(rate)}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {rate.deliveryTypeTitle}
                    {rate.service && <span className="text-gray-500 ml-2 text-xs">· {rate.service}</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    Base: {formatCurrency(rate.baseRate)} + Fuel: {formatCurrency(rate.fuelSurcharge)}
                    {rate.insuranceAmount > 0 && ` + Insurance: ${formatCurrency(rate.insuranceAmount)}`}
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(rate.totalAmount, rate.currency)}
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedRate && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            Selected: <strong>{selectedRate.deliveryTypeTitle}</strong> — {formatCurrency(selectedRate.totalAmount, selectedRate.currency)}
          </div>
        )}
      </div>

      {/* Surcharges */}
      {surcharges.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Additional Services / Surcharges</h2>
          <div className="grid grid-cols-3 gap-2">
            {surcharges.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSurcharges.includes(s.id)}
                  onChange={(e) =>
                    setSelectedSurcharges(
                      e.target.checked
                        ? [...selectedSurcharges, s.id]
                        : selectedSurcharges.filter((id) => id !== s.id)
                    )
                  }
                  className="rounded"
                />
                <span className="flex-1 truncate">{s.item}</span>
                <span className="text-gray-400 text-xs flex-shrink-0">+{formatCurrency(s.cost)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Other info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Additional Info</h2>
        <div className="grid grid-cols-3 gap-4">
          {branches.length > 0 && (
            <div>
              <label className={labelCls}>Origin Branch</label>
              <select value={originBranchId} onChange={e => setOriginBranchId(e.target.value)} className={inputCls}>
                <option value="">— Select branch —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Pickup Date</label>
            <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Special instructions..." />
          </div>
        </div>
      </div>

      {(error || Object.keys(validationErrors).length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error && <div className="font-medium">{error}</div>}
          {Object.keys(validationErrors).length > 0 && (
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {Object.entries(validationErrors).map(([field, msg]) => (
                <li key={field}>
                  <span className="font-medium">{field}:</span> {msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <a href="/shipments" className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </a>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-8 py-2.5 rounded-lg transition-colors"
        >
          {loading ? "Creating..." : "Create Shipment"}
        </button>
      </div>
    </form>
  );
}
