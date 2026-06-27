"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CANADA_PROVINCES, VIETNAM_PROVINCES, formatCurrency } from "@/lib/utils";
import { VOLUME_DIVISOR, VOLUME_EXCESS_RATE } from "@/lib/freight-config";
import AddressSearch, { type AddressEntry } from "./AddressSearch";

type Location = { id: string; name: string; slug: string };
type Branch = { id: string; name: string; code: string };
type Surcharge = {
  id: string;
  item: string;
  cost: number;
  costType: string;
  hazardType: string | null;
};
type Package = {
  description: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  value: string;
  isFragile: boolean;
};
type UserResult = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  userCode: string | null;
  role: string;
  userRate: { ratePerKg: number; isActive: boolean } | null;
};
type ZoneRate = {
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

const HAZARD_LABELS: Record<string, string> = {
  NONE: "None",
  BATTERY_B: "Battery (B)",
  BATTERY_BHV: "Battery HV (B-HV)",
  FRAGILE: "Fragile",
  MAGNETIC: "Magnetic",
  LIQUID: "Liquid",
  RESCUE: "Relief Goods",
};

export default function NewShipmentForm({ locations, branches, surcharges, userBranchId }: Props) {
  const router = useRouter();

  // Sender search / link
  const [senderQuery, setSenderQuery] = useState("");
  const [senderResults, setSenderResults] = useState<UserResult[]>([]);
  const [selectedSender, setSelectedSender] = useState<UserResult | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);

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

  // Freight calculation
  const [ratePerKg, setRatePerKg] = useState("");
  const [rateSource, setRateSource] = useState<"custom" | "manual" | "none">("none");

  // Zone rate (optional carrier selection)
  const [originLocationId, setOriginLocationId] = useState(locations[0]?.id ?? "");
  const [destLocationId, setDestLocationId] = useState(
    locations.find(l => l.slug.includes("vietnam"))?.id ?? locations[1]?.id ?? ""
  );
  const [insuranceValue, setInsuranceValue] = useState("0");
  const [zoneRates, setZoneRates] = useState<ZoneRate[]>([]);
  const [selectedZoneRate, setSelectedZoneRate] = useState<ZoneRate | null>(null);
  const [calculatingRates, setCalculatingRates] = useState(false);
  const [rateError, setRateError] = useState("");

  // Other
  const [selectedSurcharges, setSelectedSurcharges] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [originBranchId, setOriginBranchId] = useState(userBranchId ?? "");
  const [pickupDate, setPickupDate] = useState("");
  const [transportMode, setTransportMode] = useState("AIR");
  const [paymentMethod, setPaymentMethod] = useState("PENDING");
  const [hazardType, setHazardType] = useState("NONE");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [truckVendor, setTruckVendor] = useState("");
  const [truckCost, setTruckCost] = useState("");
  const [marketingTracker, setMarketingTracker] = useState("");
  const [shipmentCategory, setShipmentCategory] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ── Computed weights (memoized — only recalc when packages change) ──────────
  const grossWeight = useMemo(
    () => packages.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0),
    [packages]
  );

  const volumeWeight = useMemo(
    () => packages.reduce((sum, p) => {
      const l = parseFloat(p.length) || 0;
      const w = parseFloat(p.width) || 0;
      const h = parseFloat(p.height) || 0;
      return l > 0 && w > 0 && h > 0 ? sum + (l * w * h) / VOLUME_DIVISOR : sum;
    }, 0),
    [packages]
  );

  const rate = parseFloat(ratePerKg) || 0;

  const { baseFreight, volumeExcess, volumeSurcharge, totalFreight } = useMemo(() => {
    if (rate <= 0) return { baseFreight: 0, volumeExcess: 0, volumeSurcharge: 0, totalFreight: 0 };
    const base = parseFloat((grossWeight * rate).toFixed(2));
    const excess = Math.max(0, volumeWeight - grossWeight);
    const volSurch = parseFloat((excess * VOLUME_EXCESS_RATE).toFixed(2));
    return { baseFreight: base, volumeExcess: excess, volumeSurcharge: volSurch, totalFreight: parseFloat((base + volSurch).toFixed(2)) };
  }, [grossWeight, volumeWeight, rate]);

  // O(1) surcharge lookup Maps — surcharges prop is stable after mount
  const surchargeMap = useMemo(
    () => new Map(surcharges.map(s => [s.id, s])),
    [surcharges]
  );
  const hazardSurchargeMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of surcharges) {
      if (s.hazardType) {
        const ids = m.get(s.hazardType) ?? [];
        ids.push(s.id);
        m.set(s.hazardType, ids);
      }
    }
    return m;
  }, [surcharges]);

  // Manual surcharges cost (from selected checkboxes)
  const manualSurchargesTotal = useMemo(
    () => selectedSurcharges.reduce((sum, id) => sum + (surchargeMap.get(id)?.cost ?? 0), 0),
    [selectedSurcharges, surchargeMap]
  );

  // ── Auto-apply surcharges by hazard type ────────────────────────────────────
  useEffect(() => {
    if (hazardType && hazardType !== "NONE") {
      const matching = hazardSurchargeMap.get(hazardType) ?? [];
      if (matching.length > 0) {
        setSelectedSurcharges(prev => Array.from(new Set([...prev, ...matching])));
      }
    }
  }, [hazardType, hazardSurchargeMap]);

  // ── User search ─────────────────────────────────────────────────────────────
  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 1) { setSenderResults([]); return; }
    setSearchingUsers(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) setSenderResults(data.data);
    } finally {
      setSearchingUsers(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(senderQuery), 300);
    return () => clearTimeout(t);
  }, [senderQuery, searchUsers]);

  function selectSender(u: UserResult) {
    setSelectedSender(u);
    setSenderQuery("");
    setSenderResults([]);
    // Fill shipper fields
    setShipperName(u.name);
    setShipperPhone(u.phone ?? "");
    setShipperEmail(u.email ?? "");
    // Apply their rate if available
    if (u.userRate?.isActive && u.userRate.ratePerKg > 0) {
      setRatePerKg(String(u.userRate.ratePerKg));
      setRateSource("custom");
    } else {
      setRateSource("none");
    }
  }

  function clearSender() {
    setSelectedSender(null);
    setSenderQuery("");
    if (rateSource === "custom") {
      setRatePerKg("");
      setRateSource("none");
    }
  }

  // ── Package helpers ──────────────────────────────────────────────────────────
  function addPackage() { setPackages([...packages, { ...EMPTY_PACKAGE }]); }
  function removePackage(i: number) {
    if (packages.length === 1) return;
    setPackages(packages.filter((_, idx) => idx !== i));
  }
  function updatePackage(i: number, field: keyof Package, value: string | boolean) {
    const updated = [...packages];
    updated[i] = { ...updated[i], [field]: value };
    setPackages(updated);
  }

  function fillShipper(entry: AddressEntry) {
    setShipperName(entry.name);
    setShipperPhone(entry.phone ?? "");
    setShipperEmail(entry.email ?? "");
    setShipperAddress(entry.address ?? "");
    setShipperCity(entry.city ?? "");
    setShipperProvince(entry.province ?? "");
    setShipperPostcode(entry.postcode ?? "");
    setShipperCountry(entry.country ?? "CA");
  }

  function fillReceiver(entry: AddressEntry) {
    setReceiverName(entry.name);
    setReceiverPhone(entry.phone ?? "");
    setReceiverEmail(entry.email ?? "");
    setReceiverAddress(entry.address ?? "");
    setReceiverCity(entry.city ?? "");
    setReceiverProvince(entry.province ?? "");
    setReceiverPostcode(entry.postcode ?? "");
    setReceiverCountry(entry.country ?? "VN");
  }

  // ── Zone rate calculator (optional) ─────────────────────────────────────────
  async function handleCalculateZoneRates() {
    if (!originLocationId || !destLocationId) { setRateError("Select origin and destination"); return; }
    if (grossWeight <= 0) { setRateError("Add at least one package with weight"); return; }
    setRateError(""); setCalculatingRates(true); setZoneRates([]); setSelectedZoneRate(null);
    try {
      const res = await fetch("/api/rates/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLocationId, destLocationId, weight: grossWeight,
          packages: packages.map(p => ({
            weight: parseFloat(p.weight) || 0,
            length: parseFloat(p.length) || undefined,
            width: parseFloat(p.width) || undefined,
            height: parseFloat(p.height) || undefined,
          })),
          insuranceValue: parseFloat(insuranceValue) || 0,
        }),
      });
      const data = await res.json();
      if (!data.success) { setRateError(data.error ?? "Rate calculation failed"); return; }
      setZoneRates(data.data);
      if (data.data.length === 0) setRateError("No rates available for this route");
    } catch { setRateError("Network error"); }
    finally { setCalculatingRates(false); }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setValidationErrors({}); setLoading(true);

    try {
      // Use freight calc values if rate is set, else fall back to zone rate
      const useFreightCalc = rate > 0;
      const finalBaseRate = useFreightCalc ? baseFreight : (selectedZoneRate?.baseRate ?? 0);
      const finalFuelSurcharge = useFreightCalc ? volumeSurcharge : (selectedZoneRate?.fuelSurcharge ?? 0);
      const finalInsuranceAmount = selectedZoneRate?.insuranceAmount ?? 0;
      const finalTotal = useFreightCalc
        ? totalFreight + manualSurchargesTotal + finalInsuranceAmount
        : (selectedZoneRate?.totalAmount ?? 0) + manualSurchargesTotal;

      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipperName, shipperPhone, shipperEmail, shipperAddress,
          shipperCity, shipperProvince, shipperPostcode, shipperCountry,
          receiverName, receiverPhone, receiverEmail, receiverAddress,
          receiverCity, receiverProvince, receiverPostcode, receiverCountry,
          packages: packages.map(p => ({
            description: p.description || undefined,
            weight: parseFloat(p.weight) || 0,
            length: parseFloat(p.length) || undefined,
            width: parseFloat(p.width) || undefined,
            height: parseFloat(p.height) || undefined,
            value: parseFloat(p.value) || undefined,
            isFragile: p.isFragile,
          })),
          senderId: selectedSender?.id,
          rateId: selectedZoneRate?.rateId,
          deliveryTypeId: selectedZoneRate?.deliveryTypeId,
          baseRate: finalBaseRate,
          fuelSurcharge: finalFuelSurcharge,
          insuranceAmount: finalInsuranceAmount,
          insuranceValue: parseFloat(insuranceValue) || 0,
          surchargeIds: selectedSurcharges,
          notes: notes || undefined,
          originBranchId: originBranchId || undefined,
          pickupDate: pickupDate || undefined,
          transportMode: transportMode || undefined,
          paymentMethod: paymentMethod || undefined,
          hazardType: hazardType || undefined,
          deliveryMethod: deliveryMethod || undefined,
          truckVendor: truckVendor || undefined,
          truckCost: truckCost ? parseFloat(truckCost) : undefined,
          marketingTracker: marketingTracker || undefined,
          shipmentCategory: shipmentCategory || undefined,
          dimensionalWeight: volumeWeight > 0 ? parseFloat(volumeWeight.toFixed(3)) : undefined,
          chargeableWeight: parseFloat(grossWeight.toFixed(2)),
          ratePerKg: rate > 0 ? rate : undefined,
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
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-600";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Sender / Customer Link ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Customer / Agent</h2>
        {selectedSender ? (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex-1">
              <div className="font-medium text-green-900">{selectedSender.name}</div>
              <div className="text-xs text-green-600">
                {selectedSender.userCode && <span className="mr-2">#{selectedSender.userCode}</span>}
                {selectedSender.email}
                {selectedSender.phone && <span className="ml-2">{selectedSender.phone}</span>}
              </div>
              {selectedSender.userRate?.isActive ? (
                <div className="text-xs text-green-700 mt-1 font-medium">
                  Custom rate: {formatCurrency(selectedSender.userRate.ratePerKg)}/kg
                </div>
              ) : (
                <div className="text-xs text-gray-400 mt-1">No custom rate — enter rate manually</div>
              )}
            </div>
            <button type="button" onClick={clearSender} className="text-xs text-gray-400 hover:text-red-500">
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={senderQuery}
              onChange={e => setSenderQuery(e.target.value)}
              className={inputCls}
              placeholder="Search by name, email, code, phone..."
            />
            {searchingUsers && (
              <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>
            )}
            {senderResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-100 max-h-56 overflow-auto">
                {senderResults.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => selectSender(u)}
                    className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-sm"
                  >
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-xs text-gray-400">
                      {u.userCode && <span className="mr-1">#{u.userCode}</span>}
                      {u.email}
                      {u.userRate?.isActive && (
                        <span className="ml-2 text-green-600 font-medium">
                          Rate: {formatCurrency(u.userRate.ratePerKg)}/kg
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Addresses ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5">
        {/* Shipper */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Shipper (From)</h2>
          <AddressSearch type="shipper" onSelect={fillShipper} />
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={shipperName} onChange={e => setShipperName(e.target.value)} required className={inputCls} placeholder="John Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input value={shipperPhone} onChange={e => setShipperPhone(e.target.value)} className={inputCls} />
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
                <input value={shipperPostcode} onChange={e => setShipperPostcode(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {/* Receiver */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Receiver (To)</h2>
          <AddressSearch type="receiver" onSelect={fillReceiver} />
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input value={receiverName} onChange={e => setReceiverName(e.target.value)} required className={inputCls} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Phone</label>
                <input value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} className={inputCls} />
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

      {/* ── Shipment Info ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Shipment Info</h2>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Transport Mode *</label>
            <select value={transportMode} onChange={e => setTransportMode(e.target.value)} className={inputCls}>
              <option value="AIR">AIR</option>
              <option value="SEA">SEA</option>
              <option value="TRUCK">TRUCK</option>
              <option value="LOCAL_MOVING">LOCAL MOVING</option>
              <option value="AIR_CANADA">AIR CANADA</option>
              <option value="FAST_TRACK">FAST TRACK</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={inputCls}>
              <option value="PENDING">Pending</option>
              <option value="PAY_IN_VIETNAM">Pay in Vietnam</option>
              <option value="PAY_IN_CANADA">Pay in Canada</option>
              <option value="PAID_OK2SHIP">Paid (OK2SHIP)</option>
              <option value="CASH">Cash</option>
              <option value="ETRANSFER">e-Transfer</option>
              <option value="CARD">Card</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Hazard / Special</label>
            <select value={hazardType} onChange={e => setHazardType(e.target.value)} className={inputCls}>
              {Object.entries(HAZARD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Delivery Method</label>
            <select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              <option value="COLLECT_AT_OFFICE">Collect at Office</option>
              <option value="HOME_DELIVERY">Home Delivery</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Packages ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Packages</h2>
          <button type="button" onClick={addPackage} className="text-sm text-green-700 hover:underline">
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
        </div>
      </div>

      {/* ── Freight Calculation ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Freight Calculation</h2>

        {/* Rate input */}
        <div className="flex items-end gap-4 mb-4">
          <div className="w-48">
            <label className={labelCls}>
              Rate per kg (CAD)
              {rateSource === "custom" && (
                <span className="ml-1 text-green-600 font-normal">(custom rate)</span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ratePerKg}
              onChange={e => { setRatePerKg(e.target.value); setRateSource("manual"); }}
              className={inputCls}
              placeholder="e.g. 5.50"
            />
          </div>
          {!selectedSender && (
            <p className="text-xs text-gray-400 pb-2">
              Select a customer above to auto-load their rate.
            </p>
          )}
        </div>

        {/* Weight breakdown */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2.5 text-gray-500 w-48">Gross Weight</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">
                  {grossWeight.toFixed(2)} kg
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400">Actual weight of all packages</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-gray-500">Volume Weight</td>
                <td className="px-4 py-2.5 font-semibold text-gray-900">
                  {volumeWeight > 0 ? (
                    <span className={volumeWeight > grossWeight ? "text-orange-600" : ""}>
                      {volumeWeight.toFixed(3)} kg
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400">
                  L × W × H (cm) ÷ {VOLUME_DIVISOR}
                  {volumeWeight > grossWeight && (
                    <span className="ml-1 text-orange-500 font-medium">vol &gt; gross — excess applies</span>
                  )}
                </td>
              </tr>
              {rate > 0 && (
                <>
                  <tr className="bg-white">
                    <td className="px-4 py-2.5 text-gray-500">Base Freight</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">
                      {formatCurrency(baseFreight)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {grossWeight.toFixed(2)} kg × {formatCurrency(rate)}/kg
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-4 py-2.5 text-gray-500">Volume Surcharge</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">
                      {volumeSurcharge > 0 ? (
                        <span className="text-orange-600">{formatCurrency(volumeSurcharge)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {volumeSurcharge > 0
                        ? `${volumeExcess.toFixed(3)} kg excess × $${VOLUME_EXCESS_RATE}/kg`
                        : "No volumetric excess"}
                    </td>
                  </tr>
                  {manualSurchargesTotal > 0 && (
                    <tr className="bg-white">
                      <td className="px-4 py-2.5 text-gray-500">Additional Surcharges</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{formatCurrency(manualSurchargesTotal)}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">{selectedSurcharges.length} item(s) selected</td>
                    </tr>
                  )}
                  <tr className="bg-green-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">Total Freight</td>
                    <td className="px-4 py-3 font-bold text-lg text-green-800">
                      {formatCurrency(totalFreight + manualSurchargesTotal)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">CAD</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Surcharges ────────────────────────────────────────────────────── */}
      {surcharges.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Additional Surcharges</h2>
          <div className="grid grid-cols-3 gap-2">
            {surcharges.map((s) => {
              const isAutoApplied = s.hazardType && s.hazardType === hazardType && hazardType !== "NONE";
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2 text-sm cursor-pointer px-2 py-1.5 rounded ${
                    isAutoApplied ? "bg-orange-50 text-orange-800" : "text-gray-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSurcharges.includes(s.id)}
                    onChange={e =>
                      setSelectedSurcharges(
                        e.target.checked
                          ? [...selectedSurcharges, s.id]
                          : selectedSurcharges.filter(id => id !== s.id)
                      )
                    }
                    className="rounded"
                  />
                  <span className="flex-1 truncate">{s.item}</span>
                  {isAutoApplied && <span className="text-xs text-orange-500">auto</span>}
                  <span className="text-gray-400 text-xs flex-shrink-0">+{formatCurrency(s.cost)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Optional: Zone/Carrier Rate ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Carrier Rate (Optional)</h2>
          <span className="text-xs text-gray-400">Used if no freight rate above is set</span>
        </div>
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
              onClick={handleCalculateZoneRates}
              disabled={calculatingRates || grossWeight <= 0}
              className="w-full bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {calculatingRates ? "Calculating..." : "Calculate"}
            </button>
          </div>
        </div>
        {rateError && <div className="text-sm text-red-600 mb-3">{rateError}</div>}
        {zoneRates.length > 0 && (
          <div className="space-y-2">
            {zoneRates.map(rate => (
              <label
                key={rate.rateId}
                className={`flex items-center gap-4 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedZoneRate?.rateId === rate.rateId
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-green-300"
                }`}
              >
                <input
                  type="radio"
                  name="zoneRate"
                  checked={selectedZoneRate?.rateId === rate.rateId}
                  onChange={() => setSelectedZoneRate(rate)}
                  className="text-green-700"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{rate.deliveryTypeTitle}
                    {rate.service && <span className="text-gray-400 ml-1 text-xs">· {rate.service}</span>}
                  </div>
                  <div className="text-xs text-gray-400">
                    Base: {formatCurrency(rate.baseRate)} + Fuel: {formatCurrency(rate.fuelSurcharge)}
                    {rate.insuranceAmount > 0 && ` + Insurance: ${formatCurrency(rate.insuranceAmount)}`}
                  </div>
                </div>
                <div className="text-lg font-bold">{formatCurrency(rate.totalAmount, rate.currency)}</div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Logistics ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Logistics</h2>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Truck Vendor</label>
            <select value={truckVendor} onChange={e => setTruckVendor(e.target.value)} className={inputCls}>
              <option value="">— None —</option>
              <option value="VITRAN">VITRAN</option>
              <option value="FREIGHTCOM">FREIGHTCOM</option>
              <option value="DIAMOND_DELIVERY">DIAMOND DELIVERY</option>
              <option value="CVC">CVC</option>
              <option value="KTX">KTX</option>
              <option value="KDEXPRESS">KDEXPRESS</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Truck Cost (CAD)</label>
            <input type="number" step="0.01" min="0" value={truckCost} onChange={e => setTruckCost(e.target.value)} className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <input value={shipmentCategory} onChange={e => setShipmentCategory(e.target.value)} className={inputCls} placeholder="e.g. Electronics" />
          </div>
          <div>
            <label className={labelCls}>Marketing Source</label>
            <select value={marketingTracker} onChange={e => setMarketingTracker(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              <option value="WALK_IN">Walk-in</option>
              <option value="PAGE">Page</option>
              <option value="FB_AD">FB-Ad</option>
              <option value="HOTLINE">Hotline</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Additional Info ───────────────────────────────────────────────── */}
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
                <li key={field}><span className="font-medium">{field}:</span> {msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <a href="/shipments" className="text-sm text-gray-500 hover:text-gray-700">Cancel</a>
        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white font-medium px-8 py-2.5 rounded-lg transition-colors"
        >
          {loading ? "Creating..." : "Create Shipment"}
        </button>
      </div>
    </form>
  );
}
