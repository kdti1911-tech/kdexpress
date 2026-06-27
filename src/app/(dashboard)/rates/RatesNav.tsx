import Link from "next/link";

const tabs = [
  { key: "zones", href: "/rates", label: "Rate Zones" },
  { key: "customer-rates", href: "/rates/customer-rates", label: "Customer Rates" },
  { key: "surcharges", href: "/rates/surcharges", label: "Surcharges" },
];

export default function RatesNav({ active }: { active: "zones" | "customer-rates" | "surcharges" }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 -mx-px">
      {tabs.map(t => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            active === t.key
              ? "border-green-700 text-green-800"
              : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
