from datetime import date
from difflib import SequenceMatcher
from math import asin, cos, radians, sin, sqrt


def days_until_expiry(expiry_date: str, today: date | None = None) -> int:
    return (date.fromisoformat(expiry_date) - (today or date.today())).days


def stock_status(expiry_date: str, quantity: int, action_status: str | None = None, today: date | None = None) -> str:
    days = days_until_expiry(expiry_date, today)
    if days < 0:
        return "EXPIRED"
    if action_status:
        return action_status
    if days <= 30:
        return "NEAR_EXPIRY"
    if days <= 60:
        return "EXPIRING_SOON"
    if days <= 90:
        return "UPCOMING_EXPIRY"
    if quantity <= 10:
        return "LOW_STOCK"
    return "AVAILABLE"


def is_publicly_available(expiry_date: str, quantity: int, action_status: str | None = None, today: date | None = None) -> bool:
    return quantity > 0 and days_until_expiry(expiry_date, today) >= 0 and stock_status(expiry_date, quantity, action_status, today) == "AVAILABLE"


def normalize_name(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def fuzzy_score(query: str, candidate: str) -> float:
    return SequenceMatcher(None, normalize_name(query), normalize_name(candidate)).ratio()


def nearby_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    lat_delta = radians(lat2 - lat1)
    lng_delta = radians(lng2 - lng1)
    arc = sin(lat_delta / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(lng_delta / 2) ** 2
    return 6371 * 2 * asin(sqrt(arc))