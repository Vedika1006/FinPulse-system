import logging
import os
import traceback

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger("uvicorn.error")


# ✅ Handle all HTTPExceptions (including your custom ones)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
        },
    )


# ✅ Handle database errors
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": "Database error occurred",
        },
    )


# ✅ Handle unexpected errors
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s: %s\n%s", request.url.path, exc, traceback.format_exc())
    detail = "Internal server error"
    if os.getenv("DEBUG_API_ERRORS", "").strip().lower() in ("1", "true", "yes"):
        detail = f"{type(exc).__name__}: {exc}"
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": detail,
        },
    )
