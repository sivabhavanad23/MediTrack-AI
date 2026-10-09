import os
import sqlite3
from pathlib import Path


DATABASE_PATH = Path(os.environ.get("MEDITRACK_DB", Path(__file__).resolve().parents[1] / "meditrack.db"))


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('pharmacy','patient','admin')),
                pharmacy_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS pharmacies (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
                latitude REAL NOT NULL, longitude REAL NOT NULL, verified INTEGER NOT NULL DEFAULT 0,
                opening_hours TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS medicines (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, generic_name TEXT NOT NULL DEFAULT '', strength TEXT NOT NULL DEFAULT '',
                dosage_form TEXT NOT NULL DEFAULT '', manufacturer TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
                barcode TEXT NOT NULL DEFAULT '', verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS medicine_aliases (
                id INTEGER PRIMARY KEY AUTOINCREMENT, medicine_id TEXT NOT NULL REFERENCES medicines(id), alias TEXT NOT NULL,
                UNIQUE(medicine_id, alias)
            );
            CREATE TABLE IF NOT EXISTS suppliers (
                id TEXT PRIMARY KEY, pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id), name TEXT NOT NULL,
                phone TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS inventory (
                id TEXT PRIMARY KEY, pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id), medicine_id TEXT NOT NULL REFERENCES medicines(id),
                batch_number TEXT NOT NULL, manufacturing_date TEXT NOT NULL, expiry_date TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK(quantity >= 0), purchase_price REAL NOT NULL CHECK(purchase_price >= 0),
                selling_price REAL NOT NULL CHECK(selling_price >= 0), supplier TEXT NOT NULL DEFAULT '', barcode TEXT NOT NULL DEFAULT '',
                action_status TEXT, action_note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sales (
                id TEXT PRIMARY KEY, pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id), medicine_id TEXT NOT NULL REFERENCES medicines(id),
                sold_at TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0)
            );
            CREATE TABLE IF NOT EXISTS expiry_actions (
                id TEXT PRIMARY KEY, inventory_id TEXT NOT NULL REFERENCES inventory(id), action TEXT NOT NULL,
                responsible_user_id TEXT REFERENCES users(id), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY, pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id), type TEXT NOT NULL,
                message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS forecasts (
                id TEXT PRIMARY KEY, pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id), medicine_id TEXT NOT NULL REFERENCES medicines(id),
                horizon_days INTEGER NOT NULL, predicted_quantity REAL NOT NULL, model_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT REFERENCES users(id), pharmacy_id TEXT,
                action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_inventory_owner_expiry ON inventory(pharmacy_id, expiry_date);
            CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory(medicine_id, pharmacy_id);
            CREATE INDEX IF NOT EXISTS idx_sales_history ON sales(pharmacy_id, medicine_id, sold_at);
            CREATE INDEX IF NOT EXISTS idx_pharmacy_coordinates ON pharmacies(latitude, longitude);
            """
        )
        if db.execute("SELECT COUNT(*) FROM pharmacies").fetchone()[0]:
            return
        db.executemany(
            "INSERT INTO pharmacies(id,name,address,phone,latitude,longitude,verified,opening_hours) VALUES(?,?,?,?,?,?,?,?)",
            [
                ("pharmacy-1", "Green Care Pharmacy", "Road No. 12, Banjara Hills, Hyderabad", "+91 40 2345 6789", 17.4156, 78.4347, 1, "Open until 10:00 PM"),
                ("pharmacy-2", "WellSpring Medicals", "Road Number 36, Jubilee Hills, Hyderabad", "+91 40 2345 1122", 17.4312, 78.4078, 1, "Open until 9:30 PM"),
                ("pharmacy-3", "City Health Pharmacy", "Masab Tank, Hyderabad", "+91 40 2345 3344", 17.3998, 78.4532, 0, "Open until 11:00 PM"),
            ],
        )
        records = [
            ("med-1", "Paracetamol 500 mg", "Paracetamol", "500 mg", "Tablet", "Cipla", "Pain relief", "8901396388012", 1),
            ("med-2", "Cetirizine 10 mg", "Cetirizine hydrochloride", "10 mg", "Tablet", "Dr. Reddy's", "Allergy", "8901234567001", 1),
            ("med-3", "Azithromycin 500 mg", "Azithromycin", "500 mg", "Tablet", "Sun Pharma", "Antibiotic", "8901234567002", 1),
            ("med-4", "Omeprazole 20 mg", "Omeprazole", "20 mg", "Capsule", "Alkem", "Gastrointestinal", "8901234567003", 1),
            ("med-5", "ORS Orange 21 g", "Oral rehydration salts", "21 g", "Powder", "Electral", "Rehydration", "8901234567004", 1),
            ("med-6", "Vitamin B12 1500 mcg", "Methylcobalamin", "1500 mcg", "Tablet", "Mankind", "Vitamins", "8901234567005", 1),
        ]
        db.executemany("INSERT INTO medicines(id,name,generic_name,strength,dosage_form,manufacturer,category,barcode,verified) VALUES(?,?,?,?,?,?,?,?,?)", records)
        db.executemany("INSERT INTO medicine_aliases(medicine_id,alias) VALUES(?,?)", [("med-1", "paracetmol"), ("med-1", "paracetamol 500"), ("med-2", "cetrazine"), ("med-3", "azithromicin")])
        batches = [
            ("seed-1", "pharmacy-1", "med-1", "PCM-26A21", "2025-01-01", "2027-04-05", 120, 22, 35, "Cipla Distributors"),
            ("seed-2", "pharmacy-1", "med-1", "PCM-26B14", "2025-01-01", "2026-10-25", 50, 20, 32, "Cipla Distributors"),
            ("seed-3", "pharmacy-1", "med-2", "CTR-1082", "2025-06-01", "2026-11-20", 80, 28, 44, "Reddy's Wholesale"),
            ("seed-4", "pharmacy-1", "med-3", "AZ-2026X", "2025-08-01", "2026-10-05", 20, 72, 110, "Sun Pharma Supply"),
            ("seed-5", "pharmacy-1", "med-4", "OMP-9045", "2025-10-01", "2027-06-04", 5, 36, 58, "Alkem Distributors"),
            ("seed-6", "pharmacy-2", "med-5", "ORS-5510", "2026-01-01", "2026-12-24", 64, 14, 24, "Electral Supply"),
            ("seed-7", "pharmacy-2", "med-2", "CTR-1100", "2026-01-01", "2026-10-15", 12, 28, 44, "Reddy's Wholesale"),
        ]
        db.executemany("INSERT INTO inventory(id,pharmacy_id,medicine_id,batch_number,manufacturing_date,expiry_date,quantity,purchase_price,selling_price,supplier) VALUES(?,?,?,?,?,?,?,?,?,?)", batches)