from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Goal, User
from app.schemas import GoalCreate, GoalResponse, GoalUpdate
from app.core.security import get_current_user

router = APIRouter(prefix="/goals", tags=["goals"])

@router.post("/", response_model=GoalResponse)
def create_goal(
    goal: GoalCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    db_goal = Goal(
        user_id=user_id,
        name=goal.name,
        target_amount=goal.target_amount,
        saved_amount=0.0,
        deadline=goal.deadline
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.get("/", response_model=list[GoalResponse])
def get_goals(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    goals = db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()
    return goals

@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    update_data: GoalUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    goal.saved_amount = update_data.saved_amount
    db.commit()
    db.refresh(goal)
    return goal

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    db.delete(goal)
    db.commit()
    return None
