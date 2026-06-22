import bcrypt
from datetime import datetime, timedelta
from jose import jwt

from app.core.security import ALGORITHM, SECRET_KEY

ACCESS_TOKEN_EXPIRE_MINUTES = 120  # increased for better UX


def hash_password(password: str) -> str:
    """Hash with bcrypt (native lib — passlib breaks on bcrypt 4.1+ / Py 3.12+)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
