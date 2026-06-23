import type {
  User,
  Branch,
  Shipment,
  ShipmentPackage,
  ShipmentStatusHistory,
  ShipmentSurcharge,
  Rate,
  RateZone,
  Location,
  DeliveryType,
  Surcharge,
  InsurancePlan,
  UserGroup,
  CustomFieldDefinition,
  ShipmentCustomFieldValue,
  UserRole,
  ShipmentStatus,
  ShipmentType,
  PaymentStatus,
} from "@prisma/client";

export type {
  User,
  Branch,
  Shipment,
  ShipmentPackage,
  ShipmentStatusHistory,
  ShipmentSurcharge,
  Rate,
  RateZone,
  Location,
  DeliveryType,
  Surcharge,
  InsurancePlan,
  UserGroup,
  CustomFieldDefinition,
  ShipmentCustomFieldValue,
  UserRole,
  ShipmentStatus,
  ShipmentType,
  PaymentStatus,
};

export type ShipmentWithRelations = Shipment & {
  packages: ShipmentPackage[];
  statusHistory: ShipmentStatusHistory[];
  surcharges: (ShipmentSurcharge & { surcharge: Surcharge })[];
  customFields: (ShipmentCustomFieldValue & {
    field: CustomFieldDefinition;
  })[];
  sender: Pick<User, "id" | "name" | "email" | "phone" | "userCode"> | null;
  originBranch: Pick<Branch, "id" | "name" | "code"> | null;
  destBranch: Pick<Branch, "id" | "name" | "code"> | null;
};

export type ShipmentListItem = Pick<
  Shipment,
  | "id"
  | "trackingNumber"
  | "status"
  | "paymentStatus"
  | "shipperName"
  | "shipperCountry"
  | "receiverName"
  | "receiverCountry"
  | "totalWeight"
  | "totalAmount"
  | "currency"
  | "createdAt"
  | "expectedDelivery"
> & {
  sender: Pick<User, "id" | "name" | "userCode"> | null;
};

export type RateCalculationInput = {
  originLocationId: string;
  destLocationId: string;
  weight: number;
  packages: { weight: number; length?: number; width?: number; height?: number }[];
  insuranceValue?: number;
  userGroupId?: string;
};

export type RateCalculationResult = {
  rateId: string;
  deliveryTypeId: string;
  deliveryTypeTitle: string;
  brand: string | null;
  service: string | null;
  baseRate: number;
  fuelSurcharge: number;
  insuranceAmount: number;
  surchargesTotal: number;
  totalAmount: number;
  currency: string;
  logoUrl: string | null;
};

export type CreateShipmentInput = {
  shipmentType: ShipmentType;
  shipperName: string;
  shipperPhone?: string;
  shipperEmail?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperProvince?: string;
  shipperPostcode?: string;
  shipperCountry: string;
  receiverName: string;
  receiverPhone?: string;
  receiverEmail?: string;
  receiverAddress?: string;
  receiverCity?: string;
  receiverProvince?: string;
  receiverPostcode?: string;
  receiverCountry: string;
  packages: {
    description?: string;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    value?: number;
    isFragile?: boolean;
    isDangerous?: boolean;
  }[];
  rateId?: string;
  deliveryTypeId?: string;
  baseRate?: number;
  insuranceValue?: number;
  surchargeIds?: string[];
  pickupDate?: string;
  expectedDelivery?: string;
  notes?: string;
  customFields?: Record<string, string>;
  originBranchId?: string;
  destBranchId?: string;
};

export type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
