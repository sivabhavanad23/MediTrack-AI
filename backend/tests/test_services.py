import unittest
from datetime import date

from backend.app.services import days_until_expiry, fuzzy_score, is_publicly_available, nearby_distance_km, stock_status


class InventoryRuleTests(unittest.TestCase):
    today = date(2026, 10, 7)

    def test_expired_batch_is_not_publicly_available(self):
        expiry = "2026-10-06"
        self.assertEqual(stock_status(expiry, 50, today=self.today), "EXPIRED")
        self.assertFalse(is_publicly_available(expiry, 50, today=self.today))

    def test_expiry_day_is_near_expiry_and_not_publicly_available(self):
        self.assertEqual(stock_status("2026-10-07", 50, today=self.today), "NEAR_EXPIRY")
        self.assertFalse(is_publicly_available("2026-10-07", 50, today=self.today))

    def test_zero_quantity_is_not_available(self):
        self.assertFalse(is_publicly_available("2027-01-01", 0, today=self.today))

    def test_quarantined_batch_is_not_available(self):
        self.assertFalse(is_publicly_available("2027-01-01", 20, "QUARANTINED", self.today))

    def test_action_status_does_not_hide_expired_state(self):
        self.assertEqual(stock_status("2026-10-06", 20, "RETURN_PENDING", self.today), "EXPIRED")
        self.assertFalse(is_publicly_available("2026-10-06", 20, "RETURN_PENDING", self.today))

    def test_expiry_warning_windows(self):
        self.assertEqual(stock_status("2026-11-06", 40, today=self.today), "NEAR_EXPIRY")
        self.assertEqual(stock_status("2026-12-06", 40, today=self.today), "EXPIRING_SOON")
        self.assertEqual(stock_status("2027-01-05", 40, today=self.today), "UPCOMING_EXPIRY")
        self.assertEqual(days_until_expiry("2026-10-06", self.today), -1)

    def test_fuzzy_matching_is_spelling_only(self):
        self.assertGreater(fuzzy_score("Paracetmol 500", "Paracetamol 500 mg"), 0.8)

    def test_nearby_distance_is_symmetric(self):
        first = nearby_distance_km(17.4156, 78.4347, 17.4312, 78.4078)
        second = nearby_distance_km(17.4312, 78.4078, 17.4156, 78.4347)
        self.assertGreater(first, 0)
        self.assertAlmostEqual(first, second, places=6)


if __name__ == "__main__":
    unittest.main()