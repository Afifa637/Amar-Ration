# Amar Ration - Targeted Regression Test Plan

## 1) Bulk upload scope validation
- Distributor uploads in-scope row => accepted.
- Distributor uploads out-of-scope row => row rejected with scope error.
- Admin uploads same out-of-scope row => accepted.

## 2) Bulk upload UX behavior
- Click **আগে যাচাই করুন** => response indicates validation only and no DB save.
- Click **আসল নিবন্ধন সংরক্ষণ করুন** => inserted count increases and DB records are created.

## 3) Ration item propagation
- Plan session with `ডাল`.
- Start session and issue token.
- Confirm token `rationItem` is `ডাল`.
- Complete distribution and verify stock/reporting reflects `ডাল` item path.

## 4) Offline queue payload validation
- POST invalid payload shape => `400`.
- POST `SCAN` payload with `qrPayload` => accepted.
- POST `COMPLETE` payload with `tokenCode` + `actualKg > 0` => accepted.
- Unsupported `action` => `400`.

## 5) Consumer code uniqueness under concurrency
- Trigger parallel consumer creations.
- Assert unique `consumerCode` values and no duplicate key errors for code collisions.

## 6) Backend startup without sharp
- Simulate missing `sharp` dependency.
- Ensure backend starts.
- `uploadPhoto` returns `503 PHOTO_SERVICE_UNAVAILABLE`.
- Other APIs remain functional.

## 7) Frontend API base URL behavior
- In dev without `VITE_API_BASE_URL`, base URL falls back to `http://localhost:5000/api`.
- In prod build without env, base URL uses `/api`.
- With `VITE_API_BASE_URL`, requests use configured value.
