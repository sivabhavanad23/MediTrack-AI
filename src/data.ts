export type StockStatus =
  | "AVAILABLE"
  | "LOW_STOCK"
  | "NEAR_EXPIRY"
  | "EXPIRING_SOON"
  | "UPCOMING_EXPIRY"
  | "EXPIRED"
  | "QUARANTINED"
  | "RETURN_PENDING"
  | "RETURNED"
  | "DISPOSAL_PENDING"
  | "DISPOSED";

export type Medicine = {
  id: string;
  name: string;
  ingredient: string;
  strength: string;
  form: string;
  manufacturer: string;
  category: string;
  barcode: string;
  verified: boolean;
  aliases: string[];
};

export type StockBatch = {
  id: string;
  medicineId: string;
  pharmacyId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  supplier: string;
  updatedAt: string;
  actionStatus?:
    "RETURN_PENDING" | "RETURNED" | "DISPOSAL_PENDING" | "DISPOSED";
  actionNote?: string;
};

export type Pharmacy = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  verified: boolean;
  hours: string;
};

export const pharmacies: Pharmacy[] = [
  {
    id: "pharmacy-1",
    name: "Green Care Pharmacy",
    address: "Road No. 12, Banjara Hills, Hyderabad",
    phone: "+91 40 2345 6789",
    lat: 17.4156,
    lng: 78.4347,
    verified: true,
    hours: "Open until 10:00 PM",
  },
  {
    id: "pharmacy-2",
    name: "WellSpring Medicals",
    address: "Rd Number 36, Jubilee Hills, Hyderabad",
    phone: "+91 40 2345 1122",
    lat: 17.4312,
    lng: 78.4078,
    verified: true,
    hours: "Open until 9:30 PM",
  },
  {
    id: "pharmacy-3",
    name: "City Health Pharmacy",
    address: "Masab Tank, Hyderabad",
    phone: "+91 40 2345 3344",
    lat: 17.3998,
    lng: 78.4532,
    verified: false,
    hours: "Open until 11:00 PM",
  },
];

export const medicines: Medicine[] = [
  {
    id: "med-1",
    name: "Paracetamol 500 mg",
    ingredient: "Paracetamol",
    strength: "500 mg",
    form: "Tablet",
    manufacturer: "Cipla",
    category: "Pain relief",
    barcode: "8901396388012",
    verified: true,
    aliases: ["paracetmol", "paracetamol 500", "acetaminophen"],
  },
  {
    id: "med-2",
    name: "Cetirizine 10 mg",
    ingredient: "Cetirizine hydrochloride",
    strength: "10 mg",
    form: "Tablet",
    manufacturer: "Dr. Reddy’s",
    category: "Allergy",
    barcode: "8901234567001",
    verified: true,
    aliases: ["cetrazine", "cetrizine"],
  },
  {
    id: "med-3",
    name: "Azithromycin 500 mg",
    ingredient: "Azithromycin",
    strength: "500 mg",
    form: "Tablet",
    manufacturer: "Sun Pharma",
    category: "Antibiotic",
    barcode: "8901234567002",
    verified: true,
    aliases: ["azithromicin"],
  },
  {
    id: "med-4",
    name: "Omeprazole 20 mg",
    ingredient: "Omeprazole",
    strength: "20 mg",
    form: "Capsule",
    manufacturer: "Alkem",
    category: "Gastrointestinal",
    barcode: "8901234567003",
    verified: true,
    aliases: ["omeprazol"],
  },
  {
    id: "med-5",
    name: "ORS Orange 21 g",
    ingredient: "Oral rehydration salts",
    strength: "21 g",
    form: "Powder",
    manufacturer: "Electral",
    category: "Rehydration",
    barcode: "8901234567004",
    verified: true,
    aliases: ["ors"],
  },
  {
    id: "med-6",
    name: "Vitamin B12 1500 mcg",
    ingredient: "Methylcobalamin",
    strength: "1500 mcg",
    form: "Tablet",
    manufacturer: "Mankind",
    category: "Vitamins",
    barcode: "8901234567005",
    verified: true,
    aliases: ["b12"],
  },
  {
    id: "med-7",
    name: "Paracetamol 650 mg",
    ingredient: "Paracetamol",
    strength: "650 mg",
    form: "Tablet",
    manufacturer: "Micro Labs",
    category: "Pain relief",
    barcode: "8901234567006",
    verified: true,
    aliases: ["paracetamol 650"],
  },
];

const dateOffset = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const initialInventory: StockBatch[] = [
  {
    id: "batch-1",
    medicineId: "med-1",
    pharmacyId: "pharmacy-1",
    batchNumber: "PCM-26A21",
    manufacturingDate: dateOffset(-270),
    expiryDate: dateOffset(180),
    quantity: 120,
    purchasePrice: 22,
    sellingPrice: 35,
    supplier: "Cipla Distributors",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "batch-2",
    medicineId: "med-1",
    pharmacyId: "pharmacy-1",
    batchNumber: "PCM-26B14",
    manufacturingDate: dateOffset(-330),
    expiryDate: dateOffset(18),
    quantity: 50,
    purchasePrice: 20,
    sellingPrice: 32,
    supplier: "Cipla Distributors",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "batch-3",
    medicineId: "med-2",
    pharmacyId: "pharmacy-1",
    batchNumber: "CTR-1082",
    manufacturingDate: dateOffset(-290),
    expiryDate: dateOffset(44),
    quantity: 80,
    purchasePrice: 28,
    sellingPrice: 44,
    supplier: "Reddy’s Wholesale",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "batch-4",
    medicineId: "med-3",
    pharmacyId: "pharmacy-1",
    batchNumber: "AZ-2026X",
    manufacturingDate: dateOffset(-360),
    expiryDate: dateOffset(-2),
    quantity: 20,
    purchasePrice: 72,
    sellingPrice: 110,
    supplier: "Sun Pharma Supply",
    updatedAt: new Date().toISOString(),
    actionStatus: undefined,
  },
  {
    id: "batch-5",
    medicineId: "med-4",
    pharmacyId: "pharmacy-1",
    batchNumber: "OMP-9045",
    manufacturingDate: dateOffset(-120),
    expiryDate: dateOffset(240),
    quantity: 5,
    purchasePrice: 36,
    sellingPrice: 58,
    supplier: "Alkem Distributors",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "batch-6",
    medicineId: "med-5",
    pharmacyId: "pharmacy-2",
    batchNumber: "ORS-5510",
    manufacturingDate: dateOffset(-60),
    expiryDate: dateOffset(78),
    quantity: 64,
    purchasePrice: 14,
    sellingPrice: 24,
    supplier: "Electral Supply",
    updatedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: "batch-7",
    medicineId: "med-6",
    pharmacyId: "pharmacy-2",
    batchNumber: "B12-4440",
    manufacturingDate: dateOffset(-190),
    expiryDate: dateOffset(350),
    quantity: 32,
    purchasePrice: 60,
    sellingPrice: 92,
    supplier: "Mankind Healthcare",
    updatedAt: new Date(Date.now() - 38 * 60_000).toISOString(),
  },
  {
    id: "batch-8",
    medicineId: "med-7",
    pharmacyId: "pharmacy-3",
    batchNumber: "PCM-650-77",
    manufacturingDate: dateOffset(-210),
    expiryDate: dateOffset(270),
    quantity: 95,
    purchasePrice: 31,
    sellingPrice: 48,
    supplier: "Micro Labs",
    updatedAt: new Date(Date.now() - 65 * 60_000).toISOString(),
  },
  {
    id: "batch-9",
    medicineId: "med-2",
    pharmacyId: "pharmacy-2",
    batchNumber: "CTR-1100",
    manufacturingDate: dateOffset(-170),
    expiryDate: dateOffset(8),
    quantity: 12,
    purchasePrice: 28,
    sellingPrice: 44,
    supplier: "Reddy’s Wholesale",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "batch-10",
    medicineId: "med-3",
    pharmacyId: "pharmacy-3",
    batchNumber: "AZ-2026Q",
    manufacturingDate: dateOffset(-90),
    expiryDate: dateOffset(150),
    quantity: 0,
    purchasePrice: 70,
    sellingPrice: 108,
    supplier: "Sun Pharma Supply",
    updatedAt: new Date().toISOString(),
  },
];

export function daysUntilExpiry(
  expiryDate: string,
  today = new Date(),
): number {
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  return Math.floor((expiry.getTime() - current.getTime()) / 86_400_000);
}

export function getStockStatus(
  batch: StockBatch,
  today = new Date(),
): StockStatus {
  const days = daysUntilExpiry(batch.expiryDate, today);
  if (days < 0) return "EXPIRED";
  if (batch.actionStatus) return batch.actionStatus;
  if (days <= 30) return "NEAR_EXPIRY";
  if (days <= 60) return "EXPIRING_SOON";
  if (days <= 90) return "UPCOMING_EXPIRY";
  if (batch.quantity <= 10) return "LOW_STOCK";
  return "AVAILABLE";
}

export function isPubliclyAvailable(
  batch: StockBatch,
  today = new Date(),
): boolean {
  return (
    batch.quantity > 0 &&
    daysUntilExpiry(batch.expiryDate, today) >= 0 &&
    getStockStatus(batch, today) === "AVAILABLE"
  );
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(mg|mcg|g|ml|tablet|tablets|capsule|capsules)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[right.length];
}

export function findMedicineMatches(query: string, limit = 5): Medicine[] {
  const normalizedQuery = normalizeName(query.trim());
  if (!normalizedQuery) return [];
  return medicines
    .map((medicine) => {
      const candidates = [
        medicine.name,
        medicine.ingredient,
        ...medicine.aliases,
      ].map(normalizeName);
      const score = Math.min(
        ...candidates.map((candidate) => {
          if (
            candidate.includes(normalizedQuery) ||
            normalizedQuery.includes(candidate)
          )
            return 0;
          return (
            editDistance(normalizedQuery, candidate) /
            Math.max(normalizedQuery.length, candidate.length)
          );
        }),
      );
      return { medicine, score };
    })
    .filter(({ score }) => score <= 0.38)
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map(({ medicine }) => medicine);
}

export function getDistanceKm(
  from: Pick<Pharmacy, "lat" | "lng">,
  to: Pick<Pharmacy, "lat" | "lng">,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}
