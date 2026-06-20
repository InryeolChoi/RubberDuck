"""할 일(Tasks) CRUD 라우터 — docs/design.md 4.1."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user
from app.db import get_db
from app.models import Task, TaskStatus
from app.quadrant import THRESHOLD
from app.schemas import (
    TaskCreate,
    TaskDraft,
    TaskParseRequest,
    TaskParseResponse,
    TaskRead,
    TaskUpdate,
)
from app.services.task_parse import parse_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _get_owned_task(task_id: str, db: Session, user) -> Task:  # noqa: ANN001
    """소유한 단건 할 일을 조회하거나 404."""
    try:
        tid = uuid.UUID(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Task not found") from exc
    task = db.get(Task, tid)
    if task is None or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[TaskRead])
def list_tasks(
    status: TaskStatus | None = None,
    quadrant: str | None = Query(default=None, pattern="^Q[1-4]$"),
    is_next: bool | None = None,
    db: Session = Depends(get_db),
):
    """할 일 목록 조회 (쿼리: status, quadrant, is_next)."""
    user = get_current_user(db)
    stmt = select(Task).where(Task.user_id == user.id)

    if status is not None:
        stmt = stmt.where(Task.status == status)
    if is_next is not None:
        stmt = stmt.where(Task.is_next == is_next)
    if quadrant is not None:
        important = Task.importance >= THRESHOLD
        urgent = Task.urgency >= THRESHOLD
        cond = {
            "Q1": important & urgent,
            "Q2": important & ~urgent,
            "Q3": ~important & urgent,
            "Q4": ~important & ~urgent,
        }[quadrant]
        stmt = stmt.where(cond)

    stmt = stmt.order_by(Task.created_at.desc())
    tasks = db.scalars(stmt).all()
    return [TaskRead.from_task(t) for t in tasks]


@router.post("/parse", response_model=TaskParseResponse)
def parse_task_text(payload: TaskParseRequest):
    """자연어 문장에서 할 일 초안을 생성한다(LLM 가능 시 사용, 아니면 폴백).

    초안은 제안일 뿐이며, 확정은 클라이언트가 POST /api/tasks로 한다.
    """
    parsed = parse_task(payload.text)
    draft = TaskDraft(
        title=parsed.title,
        importance=parsed.importance,
        urgency=parsed.urgency,
        deadline=parsed.deadline,
        estimated_minutes=parsed.estimated_minutes,
        is_sudden=parsed.is_sudden,
        tags=parsed.tags,
    )
    return TaskParseResponse(draft=draft, source=parsed.source, note=parsed.note)


@router.post("", response_model=TaskRead, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    """할 일 생성."""
    user = get_current_user(db)
    task = Task(
        user_id=user.id,
        title=payload.title,
        importance=payload.importance,
        urgency=payload.urgency,
        deadline=payload.deadline,
        is_sudden=payload.is_sudden,
        is_next=payload.is_next,
        estimated_minutes=payload.estimated_minutes,
        tags=payload.tags,
        status=payload.status,
    )
    if payload.status == TaskStatus.done:
        task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskRead.from_task(task)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: str, db: Session = Depends(get_db)):
    """할 일 단건 조회."""
    user = get_current_user(db)
    task = _get_owned_task(task_id, db, user)
    return TaskRead.from_task(task)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db)):
    """할 일 수정 (중요도/급함/상태/사분면 이동 등)."""
    user = get_current_user(db)
    task = _get_owned_task(task_id, db, user)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(task, field, value)

    # status 변화에 따라 completed_at 동기화
    if "status" in data:
        if data["status"] == TaskStatus.done and task.completed_at is None:
            task.completed_at = datetime.now(timezone.utc)
        elif data["status"] != TaskStatus.done:
            task.completed_at = None

    db.commit()
    db.refresh(task)
    return TaskRead.from_task(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    """할 일 삭제."""
    user = get_current_user(db)
    task = _get_owned_task(task_id, db, user)
    db.delete(task)
    db.commit()
