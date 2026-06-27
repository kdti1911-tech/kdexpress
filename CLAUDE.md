# KDExpress — Tài liệu dự án cho Claude

File này giúp Claude Code tiếp tục làm việc giữa các phiên. Cập nhật lần cuối: 2026-06-26 (lần 3).

---

## Dự án là gì

Xây dựng lại từ đầu hệ thống quản lý vận chuyển của công ty chuyển phát hàng Việt Nam KD Express (kdexpress.ca). Bản cũ dùng WordPress + WPCargo. Bản mới dùng **Next.js 15 + PostgreSQL**.

**Deploy:** Railway (tự động deploy khi push lên GitHub `master`)  
**Repo:** `https://github.com/kdti1911-tech/kdexpress.git`  
**Lệnh deploy Railway** (trong `railway.toml`): `npx prisma db push && npm start`

---

## Công nghệ

- **Framework:** Next.js 15 App Router (server components + client components)
- **Database:** PostgreSQL trên Railway, truy cập qua **Prisma**
- **Giao diện:** Tailwind CSS — theme **Forest Green** (`bg-green-900` sidebar, `--primary: 142.1 70.6% 29.4%`)
- **Auth:** Session tự xây (`src/lib/auth.ts`)
- **Không có Node.js local** — không chạy `npx prisma migrate dev` local; thay đổi schema qua `prisma db push` trên Railway khi deploy

---

## Cấu trúc thư mục chính

```
src/
  app/
    (auth)/login/         Trang đăng nhập
    (dashboard)/          Tất cả trang có xác thực (layout bọc Sidebar)
      dashboard/          Trang tổng quan
      shipments/          Danh sách (bulk ops) + chi tiết + invoice + customs-invoice
      manifests/          Manifest list + new + chi tiết + scan pallet
      customers/          Quản lý người dùng (bulk role change) + chi tiết khách hàng
      branches/           Quản lý chi nhánh
      rates/              Rate Zones | Customer Rates | Surcharges (3 tab)
      address-book/       Sổ địa chỉ
    label/
      [tracking]/         Nhãn dán đơn lẻ (4×6")
      print/              In nhãn hàng loạt — /label/print?ids=id1,id2,...
  components/
    Sidebar.tsx               Nav sidebar màu xanh lá (bg-green-900)
    NewShipmentForm.tsx       Form tạo shipment (tính cước, customer picker)
    ManifestForm.tsx          Form tạo manifest
    ManifestDetailClient.tsx  Chi tiết manifest (client, auto-refresh useTransition)
    PalletScanClient.tsx      Scan kiện vào pallet (client, auto-refresh useTransition)
    UpdateStatusForm.tsx      Cập nhật trạng thái shipment
    AddressSearch.tsx         Tìm kiếm địa chỉ tự động
  lib/
    auth.ts               getCurrentUser(), xử lý session
    db.ts                 Prisma client singleton
    permissions.ts        Phân quyền theo role (can(role, permission))
    utils.ts              Label maps, formatters, danh sách tỉnh thành
    rates.ts              Tính cước: calcVolumeWeight, calcFreight, getUserRate
    freight-config.ts     Hằng số tính cước (VOLUME_DIVISOR=6000, VOLUME_EXCESS_RATE=4)
prisma/
  schema.prisma           Full DB schema
```

**Lưu ý tên field schema (dễ nhầm):**
- `Pallet.code` — KHÔNG phải `palletNumber`
- `Manifest.code` — KHÔNG phải `manifestNumber`

---

## Phân quyền người dùng

Roles: `ADMIN`, `MANAGER`, `EMPLOYEE`, `DRIVER`, `AGENT`, `AGENT_VN`, `CLIENT`

Quyền chính (từ `src/lib/permissions.ts`):
- `VIEW_ALL_SHIPMENTS`: ADMIN, MANAGER, EMPLOYEE, AGENT, AGENT_VN, DRIVER
- `MANAGE_BRANCHES`: ADMIN, MANAGER (gating tạo/xóa manifest, pallet; và quản lý rates)
- `UPDATE_STATUS`: ADMIN, MANAGER, EMPLOYEE, DRIVER

---

## Schema DB — Các model chính

```prisma
Shipment          # Đơn hàng chính
ShipmentPackage   # Từng kiện hàng trong một đơn
StatusHistory     # Lịch sử trạng thái mỗi đơn

Manifest          # Lô hàng (MNF-YYYY-MM-NNN)
  status: PLANNING → LOADING → SEALED → DISPATCHED → IN_TRANSIT → ARRIVED → CLOSED
Pallet            # Pallet trong manifest (MNF-...-P001)
  status: OPEN → SEALED
PalletPackage     # Join: pallet ↔ ShipmentPackage

Branch            # Chi nhánh/kho
User              # Nhân viên / khách hàng
  userRate        # Rate riêng (optional) — xem UserRate
Rate / RateZone   # Bảng giá theo vùng (hệ thống zone cũ)
UserRate          # Rate per kg riêng cho từng agent/khách hàng (MỚI)
Surcharge         # Phụ thu (có hazardType để tự động áp dụng)
AddressEntry      # Địa chỉ đã lưu
AuditLog          # Nhật ký hệ thống
```

**Cascade trạng thái:** Khi manifest → DISPATCHED, tất cả packages tự động → `IN_TRANSIT`. Khi manifest → ARRIVED, tự động → `ARRIVED_DESTINATION`. (Xử lý trong `src/app/api/manifests/[id]/status/route.ts`)

---

## Hệ thống Manifest / Pallet

Xây từ đầu. Luồng chính:

1. **Tạo manifest** → `/manifests/new` → `POST /api/manifests` → redirect đến trang chi tiết
2. **Thêm pallet** → trong trang manifest chi tiết → `POST /api/manifests/[id]/pallets`
3. **Scan kiện vào pallet** → `/manifests/[id]/pallets/[palletId]` → `POST /api/manifests/[id]/pallets/[palletId]/packages` — chấp nhận tracking có hoặc không có dấu gạch
4. **Cập nhật trạng thái** → các nút trong trang chi tiết → `PATCH /api/manifests/[id]/status`
5. **Xóa** → không giới hạn theo trạng thái (quyết định của người dùng)

**Pattern auto-refresh** (quan trọng — không được revert):  
Cả `ManifestDetailClient` và `PalletScanClient` dùng `useTransition` + `router.refresh()` thay vì local state cho server data:
```tsx
const [isPending, startTransition] = useTransition();
function refresh() { startTransition(() => router.refresh()); }
// Tất cả mutations gọi refresh() khi thành công
// Hiện loading overlay khi isPending
// Dùng props trực tiếp (không useState(initialProp))
```

---

## Hệ thống tính cước (MỚI — Session 2026-06-26)

### Công thức
- **Volume weight** = L × W × H (cm) ÷ **6000** (ký)
- **Base freight** = gross_weight × rate_per_kg
- **Volume surcharge** = max(0, volume_weight - gross_weight) × **$4/kg**
- **Tổng cước** = base_freight + volume_surcharge

### Rate per agent/khách hàng
- Model `UserRate` — rate riêng cho từng user (một bản ghi duy nhất mỗi user)
- Nếu không có → nhân viên nhập tay khi tạo shipment
- Quản lý tại trang `/customers/[id]` (chỉ ADMIN/MANAGER)

### Phụ thu theo loại hàng
- `Surcharge.hazardType` — gắn phụ thu với loại hàng nguy hiểm
- Khi form tạo shipment chọn `hazardType` (Battery, Fragile...), các phụ thu khớp tự động được chọn

### Trường mới trong Shipment
- `ratePerKg` — rate đã áp dụng (để tái tính sau)
- `dimensionalWeight` — volume weight (đã có từ trước)
- `chargeableWeight` — gross weight (đã có từ trước)
- `fuelSurcharge` — được tái dụng cho volume surcharge trong luồng mới

### Constants (trong `src/lib/freight-config.ts`)
```ts
VOLUME_DIVISOR = 6000    // chia cho 6000 (không phải 5000)
VOLUME_EXCESS_RATE = 4   // $4 CAD/kg cho phần dư volume
```
**Lưu ý:** `freight-config.ts` an toàn import trong client components. `rates.ts` không an toàn (dùng Prisma).

---

## Nhãn dán vận chuyển

Route: `/label/[tracking]` (tối ưu in, khổ 4×6 inch)

- Hiển thị: tracking number (không có gạch), tên người gửi, tên người nhận, ghi chú, cân nặng, tên chi nhánh đích
- Không hiển thị: địa chỉ đầy đủ, số điện thoại, kích thước
- Dưới cùng: Tuyên bố từ chối trách nhiệm tiếng Việt (giữ nguyên — tài liệu khách hàng)

---

## Ngôn ngữ giao diện

**Toàn bộ UI dùng tiếng Anh.** Thống nhất từ session 2026-06-26. Không thêm chuỗi tiếng Việt vào UI components. Ngoại lệ:
- `VIETNAM_PROVINCES` trong `lib/utils.ts` — danh từ riêng, giữ tiếng Việt
- Tuyên bố từ chối trách nhiệm trên nhãn dán — giữ tiếng Việt (văn bản pháp lý khách hàng)
- Customs invoice — song ngữ cố ý (tiếng Anh / tiếng Việt) cho mục đích hải quan

---

## Theme — Forest Green

Áp dụng toàn bộ. Classes chính:
- Sidebar: `bg-green-900`, nav active: `bg-green-700`, hover: `bg-green-800`
- Logo badge: `bg-green-600`
- Nút chính: `bg-green-700 hover:bg-green-800`
- Focus rings: `ring-green-600`
- CSS var trong `globals.css`: `--primary: 142.1 70.6% 29.4%`

---

## Tóm tắt API Routes

```
/api/shipments                    GET danh sách, POST tạo mới
/api/shipments/[id]               GET chi tiết, PATCH cập nhật, DELETE
/api/shipments/[id]/status        PATCH cập nhật trạng thái
/api/shipments/bulk               DELETE xóa nhiều, PATCH assign sender nhiều
/api/manifests                    GET danh sách (hỗ trợ ?status=A,B và ?limit=N), POST tạo mới
/api/manifests/[id]               GET chi tiết, PATCH cập nhật, DELETE
/api/manifests/[id]/status        PATCH cập nhật trạng thái (cascade)
/api/manifests/[id]/pallets                             POST tạo pallet
/api/manifests/[id]/pallets/[palletId]                  PATCH seal/unseal, DELETE
/api/manifests/[id]/pallets/[palletId]/packages         POST scan, DELETE xóa kiện
/api/manifests/[id]/pallets/[palletId]/packages/bulk    POST thêm nhiều shipment vào pallet
/api/rates/calculate              POST tính cước theo zone (hệ thống cũ)
/api/rates/freight                POST tính cước theo công thức mới
/api/rates/surcharges             GET danh sách, POST tạo
/api/rates/surcharges/[id]        PATCH cập nhật, DELETE
/api/users/search                 GET tìm kiếm user
/api/users/[id]/rate              GET/PUT/DELETE rate riêng của user
/api/users/bulk                   PATCH đổi role hàng loạt
/api/auth/...                     Login/logout/session
```

**Lưu ý GET /api/manifests:** Response format là `{ success, data: { items, total, page, totalPages } }` — khác với format cũ. Trang manifests list dùng Prisma trực tiếp (không gọi API này).

---

## Lưu ý Deploy

- **Không có Node.js local** — không chạy `npm run dev`, `npx prisma`, v.v. local
- Thay đổi schema: sửa `prisma/schema.prisma`, push lên GitHub → Railway tự chạy `prisma db push`
- Không dùng `--accept-data-loss` trừ khi thực sự cần và đã xác nhận
- Railway PostgreSQL proxy: `reseau.proxy.rlwy.net:11258` (chỉ dùng tạm thời, không hardcode)

---

## Công việc đã làm theo từng session

### Session 2026-06-26 (lần 1)
1. Áp dụng theme Forest Green toàn bộ các trang
2. Thiết kế lại nhãn dán — khổ 4×6", không có dấu gạch trong tracking, tuyên bố tiếng Việt
3. Sửa lỗi trường destination trên nhãn — hiển thị `destBranch.name`
4. Xây dựng hệ thống Manifest/Pallet đầy đủ — schema, API routes, tất cả UI
5. Thêm tính năng xóa manifest và pallet (không giới hạn theo trạng thái)
6. Triển khai auto-refresh với `useTransition` trong `ManifestDetailClient` và `PalletScanClient`
7. Thống nhất toàn bộ UI text sang tiếng Anh

### Session 2026-06-26 (lần 2) — Hệ thống tính cước
1. Thêm model `UserRate` — rate riêng per user (agent/khách hàng)
2. Thêm `hazardType` vào `Surcharge` — tự động áp dụng phụ thu theo loại hàng
3. Thêm `ratePerKg` vào `Shipment` — lưu rate đã dùng
4. Viết `freight-config.ts` với constants client-safe
5. Cập nhật `rates.ts`: `calcVolumeWeight` (÷6000), `calcFreight`, `getUserRate`
6. API mới: `/api/rates/freight`, `/api/users/search`, `/api/users/[id]/rate`
7. API mới: `/api/rates/surcharges`, `/api/rates/surcharges/[id]`
8. Cập nhật `NewShipmentForm`: customer picker, breakdown cước rõ ràng, hazard auto-surcharge
9. Trang `/customers/[id]`: thêm section quản lý rate + component `UserRateForm`
10. Trang `/rates/surcharges`: quản lý surcharges với hazard type

### Session 2026-06-26 (lần 3) — Rates navigation + Bulk operations

**Rates navigation:**
1. Tạo `RatesNav.tsx` — tab nav dùng chung cho 3 trang rates
2. Trang `/rates` (Rate Zones), `/rates/customer-rates`, `/rates/surcharges` đều có tab nav
3. Trang `/rates/customer-rates` (MỚI) — quản lý rate tất cả agent/client tập trung, có search + filter, chỉnh sửa inline
4. `CustomerRatesClient.tsx` — client component, optimistic state update, không cần router.refresh()

**Bulk operations — Users:**
1. `CustomersClient.tsx` — client component với checkbox, select-all, bulk action bar
2. Bulk role change: chọn nhiều user → chọn role → Apply (`PATCH /api/users/bulk`)

**Bulk operations — Shipments:**
1. `ShipmentsClient.tsx` — client component với checkbox, select-all, 4 bulk actions
2. **Delete**: modal xác nhận → `DELETE /api/shipments/bulk`
3. **Assign Customer**: modal search user → `PATCH /api/shipments/bulk` (cập nhật `senderId`)
4. **Add to Manifest**: modal chọn manifest (PLANNING/LOADING) + pallet (OPEN) → `POST /api/manifests/[id]/pallets/[palletId]/packages/bulk`
5. **Print Labels**: mở `/label/print?ids=...` trong tab mới

**In nhãn hàng loạt:**
1. Trang `/label/print?ids=id1,id2,...` (MỚI) — render tất cả labels 4×6" với page-break giữa mỗi nhãn
2. Nút "Print All" trigger `window.print()`

**Fix lỗi deploy:**
- `Pallet.palletNumber` không tồn tại → đổi thành `Pallet.code`
- `Manifest.manifestNumber` không tồn tại → đổi thành `Manifest.code`
