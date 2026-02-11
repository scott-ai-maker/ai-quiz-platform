"""Audit logging utility for tracking security events"""

from motor.motor_asyncio import AsyncIOMotorClient
from src.models.user_model import AuditLogEntry
from datetime import datetime
import os


class AuditLogger:
    """Handles audit logging for all authentication events"""

    def __init__(self):
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.client = AsyncIOMotorClient(mongodb_url)
        self.db = self.client.quiz_platform
        self.audit_collection = self.db.audit_logs

    async def ensure_indexes(self):
        """Create database indexes for audit logs"""
        await self.audit_collection.create_index("username")
        await self.audit_collection.create_index("event_type")
        await self.audit_collection.create_index("timestamp")

    async def log_event(self, event_type: str, username: str, success: bool = True,
                        ip_address: str = None, details: str = None):
        """
        Log a security event

        Args:
            event_type: Type of event (login, failed_login, password_reset, etc.)
            username: Username associated with event
            success: Whether the event was successful
            ip_address: IP address of the request
            details: Additional details about the event
        """
        log_entry = {
            "event_type": event_type,
            "username": username,
            "timestamp": datetime.utcnow(),
            "ip_address": ip_address,
            "success": success,
            "details": details
        }

        await self.audit_collection.insert_one(log_entry)

    async def get_user_events(self, username: str, limit: int = 50) -> list[dict]:
        """
        Get recent events for a user

        Args:
            username: Username to query
            limit: Maximum number of events to return

        Returns:
            List of audit log entries
        """
        cursor = self.audit_collection.find(
            {"username": username}
        ).sort("timestamp", -1).limit(limit)

        events = []
        async for event in cursor:
            event["_id"] = str(event["_id"])
            events.append(event)

        return events

    async def get_failed_login_attempts(self, username: str, minutes: int = 30) -> int:
        """
        Get count of failed login attempts in the last N minutes

        Args:
            username: Username to query
            minutes: Number of minutes to look back

        Returns:
            Count of failed login attempts
        """
        cutoff_time = datetime.utcnow() - \
            __import__('datetime').timedelta(minutes=minutes)

        count = await self.audit_collection.count_documents({
            "username": username,
            "event_type": "failed_login",
            "timestamp": {"$gte": cutoff_time}
        })

        return count

    async def close(self):
        """Close database connection"""
        self.client.close()
