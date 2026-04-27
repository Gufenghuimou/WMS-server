# init_db.py
from sqlmodel import Session, select
from datetime import datetime, timedelta
import hashlib

from database import engine, create_db_tables
from models import User, ChatMessage

def init_application():
    create_db_tables()
    with Session(engine) as session:
        if not session.exec(select(User).where(User.username == "admin")).first():
            admin_user = User(
                username="admin",
                password_hash=hashlib.sha256("admin".encode()).hexdigest(),
                full_name="超级管理员",
                role="admin",
            )
            normal_user = User(
                username="user",
                password_hash=hashlib.sha256("123456".encode()).hexdigest(),
                full_name="小卡拉米",
                role="user",
            )
            session.add(admin_user)
            session.add(normal_user)
            session.commit()

    cutoff_date = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d %H:%M:%S")
    with Session(engine) as session:
        statement = select(ChatMessage).where(ChatMessage.timestamp < cutoff_date)
        old_msgs = session.exec(statement).all()
        for old_msg in old_msgs:
            session.delete(old_msg)
        session.commit()