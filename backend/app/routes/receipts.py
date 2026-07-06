from fastapi import APIRouter, UploadFile, File, Depends, HTTPException

from app.services.ocr_service import scan_receipt
from app.core.security import get_current_user

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("/scan")
async def scan_receipt_image(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
):
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")

    try:
        result = scan_receipt(image_bytes, content_type or "image/jpeg")
    except Exception:
        # Defense in depth: scan_receipt already catches Groq/vision failures
        # internally and returns a {"success": False, ...} dict, but this
        # guards against any other unexpected exception reaching the client
        # as a raw 500.
        raise HTTPException(status_code=503, detail="Receipt scanning is temporarily unavailable. Please enter the expense manually.")

    if isinstance(result, dict) and result.get("success") is False:
        raise HTTPException(status_code=503, detail=result.get("error") or "Receipt scanning is temporarily unavailable. Please enter the expense manually.")

    return result
