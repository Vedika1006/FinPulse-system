from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.core.security import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException

router = APIRouter(prefix="/auto-save-rules", tags=["Auto-Save Rules"])


@router.get("/", response_model=list[schemas.AutoSaveRuleResponse])
def list_auto_save_rules(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    rules = (
        db.query(models.AutoSaveRule)
        .filter(models.AutoSaveRule.user_id == user_id)
        .order_by(models.AutoSaveRule.created_at.desc())
        .all()
    )
    result = []
    for r in rules:
        goal = db.query(models.Goal).filter(models.Goal.id == r.goal_id).first()
        result.append(schemas.AutoSaveRuleResponse(
            id=r.id,
            goal_id=r.goal_id,
            goal_name=goal.name if goal else "Deleted Goal",
            type=r.type,
            value=r.value,
        ))
    return result


@router.post("/", response_model=schemas.AutoSaveRuleResponse)
def create_auto_save_rule(
    payload: schemas.AutoSaveRuleCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    goal = db.query(models.Goal).filter(
        models.Goal.id == payload.goal_id,
        models.Goal.user_id == user_id,
    ).first()
    if not goal:
        raise NotFoundException("Goal not found")

    if payload.type == "percent" and payload.value > 100:
        raise BadRequestException("Percent value cannot exceed 100")

    rule = models.AutoSaveRule(
        user_id=user_id,
        goal_id=payload.goal_id,
        type=payload.type,
        value=payload.value,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return schemas.AutoSaveRuleResponse(
        id=rule.id,
        goal_id=rule.goal_id,
        goal_name=goal.name,
        type=rule.type,
        value=rule.value,
    )


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_auto_save_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    rule = db.query(models.AutoSaveRule).filter(
        models.AutoSaveRule.id == rule_id,
        models.AutoSaveRule.user_id == user_id,
    ).first()
    if not rule:
        raise NotFoundException("Rule not found")
    db.delete(rule)
    db.commit()
    return None
