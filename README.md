# MediTrack AI

Pharmacy inventory, batch expiry tracking, and nearby medicine availability. This MVP provides a responsive React dashboard and a separate FastAPI service. Demo inventory in the browser is stored in local storage; the API uses SQLite. They are intentionally not wired together by default.

## Frontend

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The workspace opens in a pharmacy dashboard with sample records. Switch roles from the workspace control to explore patient availability search or the admin overview. Inventory added in this browser is saved locally.

OCR runs in the browser with Tesseract.js. Extracted fields are suggestions and must be reviewed; OCR is best-effort for clear English text. Barcode lookup uses the sample verified medicine catalog. Forecast numbers and sales charts are illustrative moving-average/demo data, not a trained model or actual sales history. Telugu is available for selected navigation and labels; full translation is future work.

## API

Use Python 3.10 or newer:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
$env:MEDITRACK_SECRET = "set-a-long-random-secret-for-local-use"
$env:MEDITRACK_ADMIN_EMAIL = "admin@example.test"
$env:MEDITRACK_ADMIN_PASSWORD = "set-a-long-admin-password"
uvicorn backend.app.main:app --reload
```

The API creates `backend/meditrack.db` and sample pharmacies, medicines, aliases, and batches on first start. Interactive API docs are at `http://127.0.0.1:8000/docs`. Pharmacy registration requires a name, address, latitude, and longitude. Public medicine availability does not require login.

Nearby lookup uses Haversine distance over SQLite coordinates. PostgreSQL/PostGIS is the recommended deployment datastore. Passwords use salted scrypt hashes and API tokens use HMAC-SHA256; set `MEDITRACK_SECRET` before deployment. Admin accounts are not publicly self-registerable.

When both admin environment variables are set before the API starts, one administrator account is provisioned if it does not already exist. Admin-only API operations manage pharmacy verification and verified medicine master records. Pharmacy users can record sales against their own `AVAILABLE` batches; those sales feed the 90-day moving-average forecast.

## Tests

```powershell
python -m unittest discover -s backend/tests -v
npm run build
```

## MVP boundaries

- Expiry is calculated from the batch date at read time. Expired, quarantined, return/disposal, and zero-quantity stock is never shown in public availability.
- Expired-stock actions are recorded, but supplier integrations and regulated disposal workflows are not connected.
- The API currently uses SQLite and does not include external SMS/WhatsApp delivery, production rate limiting, a trained forecast model, or a remote OCR service.
- This product is for inventory and availability only. It does not provide medical advice, diagnosis, prescriptions, or dosage recommendations. Similar names or shared ingredient records are not clinical substitution advice.# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
