from pathlib import Path

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
import os
from dotenv import load_dotenv

from app.core.exceptions import UnauthorizedException

_BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_DIR / ".env")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
SECRET_KEY = os.getenv("SECRET_KEY")

# Local dev: allow startup without .env (set SECRET_KEY in production).
if not SECRET_KEY:
    SECRET_KEY = "dev-only-insecure-secret-do-not-use-in-production-min-32-chars"

# ✅ OAuth2 scheme (path is from API root; matches auth router)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ✅ Extract user_id from JWT
def get_current_user(token: str = Depends(oauth2_scheme)) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id: int = payload.get("user_id")

        if user_id is None:
            raise UnauthorizedException("Invalid token")

        return user_id

    except JWTError:
        raise UnauthorizedException("Could not validate credentials")
