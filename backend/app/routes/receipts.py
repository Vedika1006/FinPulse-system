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

    result = scan_receipt(image_bytes, content_type or "image/jpeg")
    return result
