from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi.security import OAuth2PasswordRequestForm

import uuid
from datetime import datetime, timedelta
from app.database import get_db
from app import models, schemas
from app.utils import hash_password, verify_password, create_access_token
from app.core.security import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException

RESET_TOKENS = {}

router = APIRouter(prefix="/auth", tags=["Auth"])


# ✅ REGISTER
@router.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):

    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_user:
        raise BadRequestException("Email already registered")

    hashed_pwd = hash_password(user.password)

    name = (user.name or "").strip() or None
    if not name:
        # Fallback: infer from email prefix (keeps backward compatibility if frontend doesn't send name)
        prefix = str(user.email).split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ").strip()
        name = prefix.title() if prefix else None

    db_user = models.User(email=str(user.email), name=name, hashed_password=hashed_pwd)

    db.add(db_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BadRequestException("Email already registered") from None
    db.refresh(db_user)

    return db_user


# ✅ LOGIN
@router.post("/login", response_model=schemas.Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.email == form_data.username
    ).first()

    if not db_user or not verify_password(
        form_data.password,
        db_user.hashed_password
    ):
        raise BadRequestException("Invalid email or password")

    access_token = create_access_token(
        data={"user_id": db_user.id}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ✅ GET CURRENT USER
@router.get("/me", response_model=schemas.UserResponse)
def get_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise NotFoundException("User not found")

    return user


# ✅ UPDATE CURRENT USER
@router.put("/me", response_model=schemas.UserResponse)
def update_me(
    update_data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")
    
    if update_data.name is not None:
        user.name = update_data.name.strip() or None
        db.commit()
        db.refresh(user)

    return user


# ✅ DELETE ACCOUNT (permanent — deletes every row owned by this user)
@router.delete("/account")
def delete_account(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    # AutoSaveRule references Goal (goal_id FK), so it must be deleted first.
    db.query(models.AutoSaveRule).filter(models.AutoSaveRule.user_id == user_id).delete()
    db.query(models.Expense).filter(models.Expense.user_id == user_id).delete()
    db.query(models.Budget).filter(models.Budget.user_id == user_id).delete()
    db.query(models.Income).filter(models.Income.user_id == user_id).delete()
    db.query(models.Goal).filter(models.Goal.user_id == user_id).delete()
    db.query(models.Recurring).filter(models.Recurring.user_id == user_id).delete()
    db.query(models.Debt).filter(models.Debt.user_id == user_id).delete()
    db.query(models.TaxInvestment).filter(models.TaxInvestment.user_id == user_id).delete()
    db.query(models.UserMemory).filter(models.UserMemory.user_id == user_id).delete()

    db.delete(user)
    db.commit()

    return {"success": True, "message": "Account deleted"}


# ✅ CHANGE PASSWORD
@router.put("/password")
def change_password(
    data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")
    
    if not verify_password(data.current_password, user.hashed_password):
        raise BadRequestException("Incorrect current password")

    user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ✅ PASSWORD RECOVERY (DEMO)
@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if user:
        token = str(uuid.uuid4())
        RESET_TOKENS[token] = {
            "email": req.email,
            "expires": datetime.utcnow() + timedelta(hours=1)
        }
        print(f"\n[DEMO] Reset Token for {req.email}: {token}\n")
    return {"message": "If that email exists, we sent a password reset token. (Check server logs for demo token)"}


@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    if req.token not in RESET_TOKENS:
        raise BadRequestException("Invalid or expired token")
        
    token_data = RESET_TOKENS[req.token]
    if datetime.utcnow() > token_data["expires"]:
        del RESET_TOKENS[req.token]
        raise BadRequestException("Token expired")
        
    user = db.query(models.User).filter(models.User.email == token_data["email"]).first()
    if not user:
        raise BadRequestException("User not found")
        
    user.hashed_password = hash_password(req.new_password)
    db.commit()
    
    del RESET_TOKENS[req.token]
    return {"message": "Password reset successfully. You can now log in."}