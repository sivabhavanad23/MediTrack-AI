import base64
import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from math import ceil

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from .database import connect, initialize
from .services import days_until_expiry, fuzzy_score, is_publicly_available, nearby_distance_km, stock_status


SECRET = os.environ.get("MEDITRACK_SECRET", "local-development-secret-change-before-deploy")
TOKEN_LIFETIME_HOURS = 12
app = FastAPI(title="MediTrack AI API", version="0.1.0", description="Pharmacy inventory and medicine availability. Not medical advice.")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("MEDITRACK_CORS_ORIGINS", "http://localhost:5173").split(","), allow_credentials=True, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])
bearer = HTTPBearer(auto_error=False)


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=200)
    role: str = "pharmacy"
    pharmacy_name: str | None = None
    address: str | None = None
    phone: str = ""
    latitude: float | None = None
    longitude: float | None = None


class LoginInput(BaseModel):
    email: str
    password: str


class InventoryInput(BaseModel):
    medicine_id: str
    batch_number: str = Field(min_length=2, max_length=80)
    manufacturing_date: date
    expiry_date: date
    quantity: int = Field(ge=0)
    purchase_price: float = Field(ge=0)
    selling_price: float = Field(ge=0)
    supplier: str = Field(min_length=1, max_length=160)


class InventoryUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    selling_price: float | None = Field(default=None, ge=0)
    purchase_price: float | None = Field(default=None, ge=0)


class ExpiredAction(BaseModel):
    action: str
    notes: str = Field(default="", max_length=1000)


class MedicineInput(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    generic_name: str = Field(default="", max_length=160)
    strength: str = Field(default="", max_length=80)
    dosage_form: str = Field(default="", max_length=80)
    manufacturer: str = Field(default="", max_length=160)
    category: str = Field(default="", max_length=100)
    barcode: str = Field(default="", max_length=80)
    aliases: list[str] = Field(default_factory=list, max_length=20)


class PharmacyVerification(BaseModel):
    verified: bool


class SaleInput(BaseModel):
    inventory_id: str
    quantity: int = Field(gt=0)
    sold_at: date = Field(default_factory=date.today)


def hash_password(password: str, salt: bytes | None = None) -> str:
    actual_salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=actual_salt, n=2**14, r=8, p=1)
    return f"{base64.urlsafe_b64encode(actual_salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_text, _ = encoded.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        return hmac.compare_digest(hash_password(password, salt), encoded)
    except (ValueError, TypeError):
        return False


def issue_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode()).decode().rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user["id"], "role": user["role"], "pharmacy_id": user["pharmacy_id"], "exp": int((now + timedelta(hours=TOKEN_LIFETIME_HOURS)).timestamp())}, separators=(",", ":")).encode()).decode().rstrip("=")
    signed = f"{header}.{payload}"
    signature = base64.urlsafe_b64encode(hmac.new(SECRET.encode(), signed.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return f"{signed}.{signature}"


def decode_token(token: str) -> dict:
    try:
        header, payload, signature = token.split(".")
        signed = f"{header}.{payload}"
        expected = base64.urlsafe_b64encode(hmac.new(SECRET.encode(), signed.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if claims["exp"] <= int(datetime.now(timezone.utc).timestamp()):
            raise ValueError("expired token")
        return claims
    except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from error


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    claims = decode_token(credentials.credentials)
    with connect() as db:
        user = db.execute("SELECT id,name,email,role,pharmacy_id FROM users WHERE id=?", (claims["sub"],)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return dict(user)


def pharmacy_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] not in ("pharmacy", "admin"):
        raise HTTPException(status_code=403, detail="Pharmacy access required")
    return user


def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


def audit(db, user: dict, action: str, entity_type: str, entity_id: str) -> None:
    db.execute("INSERT INTO audit_logs(user_id,pharmacy_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)", (user["id"], user.get("pharmacy_id"), action, entity_type, entity_id))


def serialize_inventory(row, today: date | None = None) -> dict:
    item = dict(row)
    item["status"] = stock_status(item["expiry_date"], item["quantity"], item.get("action_status"), today)
    item["days_until_expiry"] = days_until_expiry(item["expiry_date"], today)
    item["publicly_available"] = is_publicly_available(item["expiry_date"], item["quantity"], item.get("action_status"), today)
    return item


@app.on_event("startup")
def startup() -> None:
    initialize()
    email = os.environ.get("MEDITRACK_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("MEDITRACK_ADMIN_PASSWORD", "")
    if email and password:
        with connect() as db:
            exists = db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone()
            if not exists:
                db.execute("INSERT INTO users(id,name,email,password_hash,role) VALUES(?,?,?,?,?)", (str(uuid.uuid4()), "MediTrack Administrator", email, hash_password(password), "admin"))


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "MediTrack AI API"}


@app.post("/auth/register", status_code=201)
def register(body: RegisterInput) -> dict:
    if body.role not in ("pharmacy", "patient"):
        raise HTTPException(status_code=400, detail="Only pharmacy and patient registration is public")
    email = body.email.strip().lower()
    pharmacy_id = None
    if body.role == "pharmacy":
        if not body.pharmacy_name or not body.address or body.latitude is None or body.longitude is None:
            raise HTTPException(status_code=422, detail="Pharmacy name, address, and location are required")
        pharmacy_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    try:
        with connect() as db:
            if pharmacy_id:
                db.execute("INSERT INTO pharmacies(id,name,address,phone,latitude,longitude) VALUES(?,?,?,?,?,?)", (pharmacy_id, body.pharmacy_name, body.address, body.phone, body.latitude, body.longitude))
            db.execute("INSERT INTO users(id,name,email,password_hash,role,pharmacy_id) VALUES(?,?,?,?,?,?)", (user_id, body.name, email, hash_password(body.password), body.role, pharmacy_id))
            audit(db, {"id": user_id, "pharmacy_id": pharmacy_id}, "REGISTER", "user", user_id)
    except Exception as error:
        if "UNIQUE constraint failed" in str(error):
            raise HTTPException(status_code=409, detail="An account with this email already exists") from error
        raise
    user = {"id": user_id, "name": body.name, "email": email, "role": body.role, "pharmacy_id": pharmacy_id}
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user}


@app.post("/auth/login")
def login(body: LoginInput) -> dict:
    with connect() as db:
        row = db.execute("SELECT id,name,email,password_hash,role,pharmacy_id FROM users WHERE email=?", (body.email.strip().lower(),)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = {key: row[key] for key in ("id", "name", "email", "role", "pharmacy_id")}
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user}


@app.get("/auth/me")
def me(user: dict = Depends(current_user)) -> dict:
    return user


@app.get("/pharmacies")
def list_pharmacies() -> list[dict]:
    with connect() as db:
        return [dict(row) for row in db.execute("SELECT id,name,address,phone,latitude,longitude,verified,opening_hours FROM pharmacies ORDER BY name")]


@app.put("/admin/pharmacies/{pharmacy_id}/verification")
def verify_pharmacy(pharmacy_id: str, body: PharmacyVerification, user: dict = Depends(admin_user)) -> dict:
    with connect() as db:
        result = db.execute("UPDATE pharmacies SET verified=? WHERE id=?", (int(body.verified), pharmacy_id))
        if not result.rowcount:
            raise HTTPException(status_code=404, detail="Pharmacy not found")
        audit(db, user, "VERIFY" if body.verified else "UNVERIFY", "pharmacy", pharmacy_id)
        row = db.execute("SELECT id,name,address,verified FROM pharmacies WHERE id=?", (pharmacy_id,)).fetchone()
    return dict(row)


@app.get("/pharmacies/nearby")
def nearby(lat: float, lng: float, radius_km: float = Query(default=10, ge=0, le=100)) -> list[dict]:
    with connect() as db:
        rows = db.execute("SELECT id,name,address,phone,latitude,longitude,verified,opening_hours FROM pharmacies").fetchall()
    results = []
    for row in rows:
        pharmacy = dict(row)
        pharmacy["distance_km"] = round(nearby_distance_km(lat, lng, pharmacy["latitude"], pharmacy["longitude"]), 2)
        if pharmacy["distance_km"] <= radius_km:
            results.append(pharmacy)
    return sorted(results, key=lambda item: item["distance_km"])


@app.get("/medicines")
def list_medicines() -> list[dict]:
    with connect() as db:
        return [dict(row) for row in db.execute("SELECT * FROM medicines ORDER BY name")]


@app.post("/medicines", status_code=201)
def create_medicine(body: MedicineInput, user: dict = Depends(admin_user)) -> dict:
    medicine_id = str(uuid.uuid4())
    aliases = sorted({alias.strip() for alias in body.aliases if alias.strip()})
    with connect() as db:
        existing = db.execute("SELECT id FROM medicines WHERE lower(name)=lower(?)", (body.name.strip(),)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Medicine name already exists in the master")
        db.execute("INSERT INTO medicines(id,name,generic_name,strength,dosage_form,manufacturer,category,barcode,verified) VALUES(?,?,?,?,?,?,?,?,1)", (medicine_id, body.name.strip(), body.generic_name.strip(), body.strength.strip(), body.dosage_form.strip(), body.manufacturer.strip(), body.category.strip(), body.barcode.strip()))
        db.executemany("INSERT INTO medicine_aliases(medicine_id,alias) VALUES(?,?)", [(medicine_id, alias) for alias in aliases])
        audit(db, user, "CREATE_VERIFIED", "medicine", medicine_id)
        record = db.execute("SELECT * FROM medicines WHERE id=?", (medicine_id,)).fetchone()
    return dict(record)


@app.get("/medicines/search")
def medicine_search(q: str = Query(min_length=1, max_length=100)) -> dict:
    with connect() as db:
        rows = db.execute("SELECT m.*, GROUP_CONCAT(a.alias, '|') AS aliases FROM medicines m LEFT JOIN medicine_aliases a ON a.medicine_id=m.id GROUP BY m.id").fetchall()
    ranked = []
    for row in rows:
        item = dict(row)
        candidates = [item["name"], item["generic_name"], *(item["aliases"] or "").split("|")]
        score = max(fuzzy_score(q, candidate) for candidate in candidates if candidate)
        if score >= 0.54:
            item["match_score"] = round(score, 3)
            ranked.append(item)
    return {"query": q, "matches": sorted(ranked, key=lambda item: item["match_score"], reverse=True)[:5]}


@app.get("/medicines/availability")
def medicine_availability(q: str = Query(min_length=1, max_length=100), lat: float = 17.4156, lng: float = 78.4347) -> dict:
    match_data = medicine_search(q)
    matches = match_data["matches"]
    if not matches:
        return {"query": q, "suggestion": None, "listings": []}
    best = matches[0]
    with connect() as db:
        rows = db.execute("SELECT i.*,m.name AS medicine_name,m.generic_name,m.manufacturer,m.dosage_form,p.name AS pharmacy_name,p.address,p.phone,p.latitude,p.longitude,p.verified FROM inventory i JOIN medicines m ON m.id=i.medicine_id JOIN pharmacies p ON p.id=i.pharmacy_id WHERE i.medicine_id=?", (best["id"],)).fetchall()
    listings = []
    for row in rows:
        item = serialize_inventory(row)
        if item["publicly_available"] and item["verified"]:
            item["distance_km"] = round(nearby_distance_km(lat, lng, item["latitude"], item["longitude"]), 2)
            listings.append(item)
    listings.sort(key=lambda item: item["distance_km"])
    return {"query": q, "suggestion": best if best["name"].lower() != q.lower() else None, "listings": listings}


@app.get("/inventory")
def inventory_list(user: dict = Depends(pharmacy_user)) -> list[dict]:
    with connect() as db:
        if user["role"] == "admin":
            rows = db.execute("SELECT i.*,m.name AS medicine_name FROM inventory i JOIN medicines m ON m.id=i.medicine_id ORDER BY i.expiry_date").fetchall()
        else:
            rows = db.execute("SELECT i.*,m.name AS medicine_name FROM inventory i JOIN medicines m ON m.id=i.medicine_id WHERE i.pharmacy_id=? ORDER BY i.expiry_date", (user["pharmacy_id"],)).fetchall()
    return [serialize_inventory(row) for row in rows]


@app.post("/inventory", status_code=201)
def inventory_create(body: InventoryInput, user: dict = Depends(pharmacy_user)) -> dict:
    if user["role"] != "admin" and not user["pharmacy_id"]:
        raise HTTPException(status_code=403, detail="A pharmacy profile is required")
    if body.expiry_date < body.manufacturing_date:
        raise HTTPException(status_code=422, detail="Expiry date cannot be before manufacturing date")
    with connect() as db:
        if not db.execute("SELECT 1 FROM medicines WHERE id=?", (body.medicine_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Medicine is not in the master database")
        if user["role"] == "admin":
            raise HTTPException(status_code=422, detail="Admin must select a target pharmacy explicitly")
        item_id = str(uuid.uuid4())
        db.execute("INSERT INTO inventory(id,pharmacy_id,medicine_id,batch_number,manufacturing_date,expiry_date,quantity,purchase_price,selling_price,supplier) VALUES(?,?,?,?,?,?,?,?,?,?)", (item_id, user["pharmacy_id"], body.medicine_id, body.batch_number.strip(), body.manufacturing_date.isoformat(), body.expiry_date.isoformat(), body.quantity, body.purchase_price, body.selling_price, body.supplier.strip()))
        audit(db, user, "CREATE", "inventory", item_id)
        row = db.execute("SELECT i.*,m.name AS medicine_name FROM inventory i JOIN medicines m ON m.id=i.medicine_id WHERE i.id=?", (item_id,)).fetchone()
    return serialize_inventory(row)


@app.put("/inventory/{item_id}")
def inventory_update(item_id: str, body: InventoryUpdate, user: dict = Depends(pharmacy_user)) -> dict:
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No changes supplied")
    with connect() as db:
        row = db.execute("SELECT * FROM inventory WHERE id=?", (item_id,)).fetchone()
        if not row or (user["role"] != "admin" and row["pharmacy_id"] != user["pharmacy_id"]):
            raise HTTPException(status_code=404, detail="Inventory batch not found")
        assignments = ",".join(f"{key}=?" for key in changes)
        db.execute(f"UPDATE inventory SET {assignments},updated_at=CURRENT_TIMESTAMP WHERE id=?", (*changes.values(), item_id))
        audit(db, user, "UPDATE", "inventory", item_id)
        updated = db.execute("SELECT i.*,m.name AS medicine_name FROM inventory i JOIN medicines m ON m.id=i.medicine_id WHERE i.id=?", (item_id,)).fetchone()
    return serialize_inventory(updated)


@app.post("/sales", status_code=201)
def record_sale(body: SaleInput, user: dict = Depends(pharmacy_user)) -> dict:
    if user["role"] != "pharmacy" or not user["pharmacy_id"]:
        raise HTTPException(status_code=403, detail="A pharmacy account is required")
    with connect() as db:
        batch = db.execute("SELECT * FROM inventory WHERE id=? AND pharmacy_id=?", (body.inventory_id, user["pharmacy_id"])).fetchone()
        if not batch:
            raise HTTPException(status_code=404, detail="Inventory batch not found")
        if not is_publicly_available(batch["expiry_date"], batch["quantity"], batch["action_status"]):
            raise HTTPException(status_code=409, detail="This batch is not available for sale")
        if body.quantity > batch["quantity"]:
            raise HTTPException(status_code=409, detail="Sale quantity exceeds current batch stock")
        db.execute("UPDATE inventory SET quantity=quantity-?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (body.quantity, body.inventory_id))
        db.execute("INSERT INTO sales(id,pharmacy_id,medicine_id,sold_at,quantity) VALUES(?,?,?,?,?)", (str(uuid.uuid4()), user["pharmacy_id"], batch["medicine_id"], body.sold_at.isoformat(), body.quantity))
        audit(db, user, "SALE", "inventory", body.inventory_id)
    return {"inventory_id": body.inventory_id, "quantity_sold": body.quantity, "quantity_remaining": batch["quantity"] - body.quantity}


@app.delete("/inventory/{item_id}", status_code=204)
def inventory_archive(item_id: str, user: dict = Depends(pharmacy_user)) -> None:
    with connect() as db:
        row = db.execute("SELECT * FROM inventory WHERE id=?", (item_id,)).fetchone()
        if not row or (user["role"] != "admin" and row["pharmacy_id"] != user["pharmacy_id"]):
            raise HTTPException(status_code=404, detail="Inventory batch not found")
        db.execute("UPDATE inventory SET action_status='QUARANTINED',updated_at=CURRENT_TIMESTAMP WHERE id=?", (item_id,))
        audit(db, user, "QUARANTINE", "inventory", item_id)


@app.get("/expiry/upcoming")
def upcoming_expiry(days: int = Query(default=90, ge=1, le=365), user: dict = Depends(pharmacy_user)) -> list[dict]:
    records = inventory_list(user)
    return [item for item in records if 0 <= item["days_until_expiry"] <= days]


@app.get("/expiry/expired")
def expired_inventory(user: dict = Depends(pharmacy_user)) -> list[dict]:
    return [item for item in inventory_list(user) if item["days_until_expiry"] < 0]


@app.post("/expired-stock/{item_id}/action")
def expired_action(item_id: str, body: ExpiredAction, user: dict = Depends(pharmacy_user)) -> dict:
    allowed = {"RETURN_PENDING", "RETURNED", "DISPOSAL_PENDING", "DISPOSED"}
    if body.action not in allowed:
        raise HTTPException(status_code=422, detail="Unsupported expired-stock action")
    with connect() as db:
        row = db.execute("SELECT * FROM inventory WHERE id=?", (item_id,)).fetchone()
        if not row or (user["role"] != "admin" and row["pharmacy_id"] != user["pharmacy_id"]):
            raise HTTPException(status_code=404, detail="Inventory batch not found")
        if days_until_expiry(row["expiry_date"]) >= 0:
            raise HTTPException(status_code=409, detail="Only expired batches can enter the expired-stock workflow")
        db.execute("UPDATE inventory SET action_status=?,action_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", (body.action, body.notes, item_id))
        db.execute("INSERT INTO expiry_actions(id,inventory_id,action,responsible_user_id,notes) VALUES(?,?,?,?,?)", (str(uuid.uuid4()), item_id, body.action, user["id"], body.notes))
        audit(db, user, body.action, "inventory", item_id)
        return {"id": item_id, "action_status": body.action, "action_note": body.notes}


@app.get("/forecast/{medicine_id}")
def forecast(medicine_id: str, user: dict = Depends(pharmacy_user)) -> dict:
    if user["role"] == "admin" or not user["pharmacy_id"]:
        raise HTTPException(status_code=403, detail="A pharmacy workspace is required")
    with connect() as db:
        medicine = db.execute("SELECT id,name FROM medicines WHERE id=?", (medicine_id,)).fetchone()
        if not medicine:
            raise HTTPException(status_code=404, detail="Medicine not found")
        sales = db.execute("SELECT COALESCE(SUM(quantity),0) AS total FROM sales WHERE pharmacy_id=? AND medicine_id=? AND sold_at>=date('now','-90 day')", (user["pharmacy_id"], medicine_id)).fetchone()["total"]
        stock = db.execute("SELECT * FROM inventory WHERE pharmacy_id=? AND medicine_id=?", (user["pharmacy_id"], medicine_id)).fetchall()
    available = sum(row["quantity"] for row in stock if is_publicly_available(row["expiry_date"], row["quantity"], row["action_status"]))
    monthly_average = ceil(sales / 3)
    predicted = round(monthly_average * 1.08)
    return {"medicine_id": medicine_id, "medicine_name": medicine["name"], "current_available_stock": available, "monthly_average_demand": monthly_average, "predicted_30_day_demand": predicted, "signal": "SHORTAGE_RISK" if available < predicted else "POTENTIAL_EXCESS" if available > predicted * 1.7 else "BALANCED", "model": "90-day moving average baseline", "medical_decision": False}


@app.get("/analytics/dashboard")
def analytics(user: dict = Depends(pharmacy_user)) -> dict:
    records = inventory_list(user)
    active = [item for item in records if item["publicly_available"]]
    expired = [item for item in records if item["days_until_expiry"] < 0]
    expiring = [item for item in records if 0 <= item["days_until_expiry"] <= 90]
    return {"medicine_types": len({item["medicine_id"] for item in records}), "total_units": sum(item["quantity"] for item in records), "available_units": sum(item["quantity"] for item in active), "near_expiry_batches": len(expiring), "expired_units": sum(item["quantity"] for item in expired), "estimated_expired_stock_value": round(sum(item["quantity"] * item["purchase_price"] for item in expired), 2), "low_stock_batches": sum(1 for item in records if 0 < item["quantity"] <= 10)}


@app.get("/notifications")
def notifications(user: dict = Depends(pharmacy_user)) -> list[dict]:
    records = inventory_list(user)
    generated = []
    for item in records:
        days = item["days_until_expiry"]
        if days < 0:
            generated.append({"type": "MEDICINE_EXPIRED", "message": f"Batch {item['batch_number']} has expired and is excluded from availability.", "inventory_id": item["id"]})
        elif days <= 30:
            generated.append({"type": "EXPIRY_CRITICAL", "message": f"{item['quantity']} units of {item['medicine_name']} expire in {days} days.", "inventory_id": item["id"]})
        elif days <= 90:
            generated.append({"type": "EXPIRY_WARNING", "message": f"{item['medicine_name']} expires within 90 days.", "inventory_id": item["id"]})
        if 0 < item["quantity"] <= 10:
            generated.append({"type": "LOW_STOCK", "message": f"{item['medicine_name']} has {item['quantity']} units in this batch.", "inventory_id": item["id"]})
    return generated