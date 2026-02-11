from motor.motor_asyncio import AsyncIOMotorClient
from src.models.user_model import (
    UserCreate, UserInDB, UserResponse, UserLogin,
    UserProfileUpdate, PasswordResetRequest, PasswordResetConfirm
)
from src.utils.password_utils import hash_password, verify_password, validate_password_strength
from src.utils.jwt_utils import create_access_token, get_token_expiry
from src.utils.audit_logger import AuditLogger
from datetime import datetime, timedelta
from typing import Optional
import os
import secrets


class AuthService:
    """Authentication service handling user registration, login, and management"""

    # Security constants
    MAX_LOGIN_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 15
    PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 30

    def __init__(self):
        # MongoDB connection
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        self.client = AsyncIOMotorClient(mongodb_url)
        self.db = self.client.quiz_platform
        self.users_collection = self.db.users
        self.audit_logger = AuditLogger()

    async def ensure_indexes(self):
        """Create database indexes for better performance"""
        await self.users_collection.create_index("username", unique=True)
        await self.users_collection.create_index("email", unique=True)
        await self.users_collection.create_index("created_at")
        await self.users_collection.create_index("role")
        await self.users_collection.create_index("locked_until")
        await self.audit_logger.ensure_indexes()

    async def create_user(self, user_data: UserCreate) -> dict:
        """
        Create a new user

        Args:
            user_data: User registration data

        Returns:
            Dictionary with success status, user data, or error message
        """
        # Validate password strength
        is_valid, message = validate_password_strength(user_data.password)
        if not is_valid:
            return {"success": False, "error": message}

        # Check if user already exists
        existing_user = await self.users_collection.find_one({
            "$or": [
                {"username": user_data.username},
                {"email": user_data.email}
            ]
        })

        if existing_user:
            field = "username" if existing_user["username"] == user_data.username else "email"
            return {"success": False, "error": f"User with this {field} already exists"}

        # Hash password and create user
        hashed_password = hash_password(user_data.password)
        user_dict = {
            "username": user_data.username,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "hashed_password": hashed_password,
            "is_active": True,
            "role": "user",
            "failed_login_attempts": 0,
            "locked_until": None,
            "password_reset_tokens": [],
            "is_2fa_enabled": False,
            "two_factor_secret": None,
            "created_at": datetime.utcnow(),
            "last_login": None,
            "last_activity": None
        }

        # Insert user into database
        result = await self.users_collection.insert_one(user_dict)
        # Convert ObjectId to string
        user_dict["_id"] = str(result.inserted_id)

        await self.audit_logger.log_event("user_registration", user_data.username, True,
                                          details=f"User {user_data.username} registered")

        return {
            "success": True,
            # JSON mode for proper serialization
            "user": UserResponse(**user_dict).model_dump(mode='json'),
            "message": "User created successfully"
        }

    async def authenticate_user(self, login_data: UserLogin) -> dict:
        """
        Authenticate user and return JWT token

        Args:
            login_data: User login credentials

        Returns:
            Dictionary with success status, token, and user data or error
        """
        # Find user by username
        user_doc = await self.users_collection.find_one({"username": login_data.username})

        if not user_doc:
            await self.audit_logger.log_event("failed_login", login_data.username, False,
                                              details="User not found")
            return {"success": False, "error": "Invalid username or password"}

        # Check if account is locked
        if user_doc.get("locked_until"):
            locked_until = user_doc["locked_until"]
            if locked_until > datetime.utcnow():
                remaining_minutes = int(
                    (locked_until - datetime.utcnow()).total_seconds() / 60)
                await self.audit_logger.log_event("login_attempt_locked", login_data.username, False,
                                                  details=f"Account locked for {remaining_minutes} minutes")
                return {"success": False, "error": f"Account is locked. Try again in {remaining_minutes} minutes"}

            # Unlock account if lockout period has expired
            await self.users_collection.update_one(
                {"_id": user_doc["_id"]},
                {"$set": {"locked_until": None, "failed_login_attempts": 0}}
            )
            user_doc["locked_until"] = None
            user_doc["failed_login_attempts"] = 0

        # Verify password
        if not verify_password(login_data.password, user_doc["hashed_password"]):
            # Increment failed login attempts
            new_attempt_count = user_doc.get("failed_login_attempts", 0) + 1
            update_data = {"failed_login_attempts": new_attempt_count}

            # Lock account if max attempts reached
            if new_attempt_count >= self.MAX_LOGIN_ATTEMPTS:
                locked_until = datetime.utcnow() + timedelta(minutes=self.LOCKOUT_DURATION_MINUTES)
                update_data["locked_until"] = locked_until
                await self.audit_logger.log_event("account_locked", login_data.username, False,
                                                  details=f"Account locked after {new_attempt_count} failed attempts")
            else:
                await self.audit_logger.log_event("failed_login", login_data.username, False,
                                                  details=f"Failed attempt {new_attempt_count}/{self.MAX_LOGIN_ATTEMPTS}")

            await self.users_collection.update_one(
                {"_id": user_doc["_id"]},
                {"$set": update_data}
            )

            return {"success": False, "error": "Invalid username or password"}

        # Check if user is active
        if not user_doc.get("is_active", True):
            await self.audit_logger.log_event("login_attempt_inactive", login_data.username, False,
                                              details="Account is inactive")
            return {"success": False, "error": "Account is deactivated"}

        # Reset failed attempts on successful login
        await self.users_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"last_login": datetime.utcnow(),
                      "last_activity": datetime.utcnow(),
                      "failed_login_attempts": 0}}
        )

        # Create access token
        token_data = {
            "sub": user_doc["username"],
            "user_id": str(user_doc["_id"])
        }
        access_token = create_access_token(token_data)

        await self.audit_logger.log_event("login_success", login_data.username, True)

        # Convert ObjectId to string for response
        user_doc["_id"] = str(user_doc["_id"])

        return {
            "success": True,
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": get_token_expiry(),
            "user": UserResponse(**user_doc).model_dump(mode='json')
        }

    async def get_user_by_username(self, username: str) -> Optional[UserInDB]:
        """
        Get user by username

        Args:
            username: Username to search for

        Returns:
            UserInDB object if found, None otherwise
        """
        user_doc = await self.users_collection.find_one({"username": username})
        if user_doc:
            return UserInDB(**user_doc)
        return None

    async def request_password_reset(self, email: str) -> dict:
        """
        Request a password reset token

        Args:
            email: Email address of user

        Returns:
            Dictionary with success status
        """
        user_doc = await self.users_collection.find_one({"email": email})

        if not user_doc:
            # Don't reveal if email exists
            await self.audit_logger.log_event("password_reset_requested", "unknown", False,
                                              details=f"Email {email} not found")
            return {"success": True, "message": "If email exists, reset link will be sent"}

        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        token_expiry = datetime.utcnow(
        ) + timedelta(minutes=self.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES)

        reset_token_doc = {
            "token": reset_token,
            "created_at": datetime.utcnow(),
            "expires_at": token_expiry,
            "used": False
        }

        await self.users_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$push": {"password_reset_tokens": reset_token_doc}}
        )

        await self.audit_logger.log_event("password_reset_requested", user_doc["username"], True)

        # In production, send this token via email
        return {
            "success": True,
            "message": "If email exists, reset link will be sent",
            "reset_token": reset_token  # In production, send via email, not in response
        }

    async def reset_password(self, reset_data: PasswordResetConfirm) -> dict:
        """
        Reset user password with reset token

        Args:
            reset_data: Password reset request data with token

        Returns:
            Dictionary with success status
        """
        # Validate new password strength
        is_valid, message = validate_password_strength(reset_data.new_password)
        if not is_valid:
            return {"success": False, "error": message}

        # Find user with valid reset token
        user_doc = await self.users_collection.find_one({
            "password_reset_tokens": {
                "$elemMatch": {
                    "token": reset_data.token,
                    "used": False,
                    "expires_at": {"$gt": datetime.utcnow()}
                }
            }
        })

        if not user_doc:
            await self.audit_logger.log_event("password_reset_failed", "unknown", False,
                                              details="Invalid or expired reset token")
            return {"success": False, "error": "Invalid or expired reset token"}

        # Hash new password
        hashed_password = hash_password(reset_data.new_password)

        # Mark token as used and update password
        await self.users_collection.update_one(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "hashed_password": hashed_password,
                    "failed_login_attempts": 0,
                    "locked_until": None
                },
                "$pull": {
                    "password_reset_tokens": {"token": reset_data.token}
                }
            }
        )

        await self.audit_logger.log_event("password_reset_success", user_doc["username"], True)

        return {"success": True, "message": "Password reset successfully. Please login with your new password"}

    async def update_user_profile(self, username: str, profile_data: UserProfileUpdate) -> dict:
        """
        Update user profile

        Args:
            username: Username of user to update
            profile_data: Profile update data

        Returns:
            Dictionary with success status and updated user
        """
        user_doc = await self.users_collection.find_one({"username": username})

        if not user_doc:
            return {"success": False, "error": "User not found"}

        # Check if new email is already taken
        if profile_data.email and profile_data.email != user_doc["email"]:
            existing = await self.users_collection.find_one({"email": profile_data.email})
            if existing:
                return {"success": False, "error": "Email already in use"}

        # Build update data
        update_data = {}
        if profile_data.full_name is not None:
            update_data["full_name"] = profile_data.full_name
        if profile_data.email is not None:
            update_data["email"] = profile_data.email

        update_data["last_activity"] = datetime.utcnow()

        # Update user
        await self.users_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": update_data}
        )

        await self.audit_logger.log_event("profile_updated", username, True,
                                          details=f"Updated fields: {list(update_data.keys())}")

        # Return updated user
        updated_user = await self.users_collection.find_one({"_id": user_doc["_id"]})
        updated_user["_id"] = str(updated_user["_id"])

        return {
            "success": True,
            "message": "Profile updated successfully",
            "user": UserResponse(**updated_user).model_dump(mode='json')
        }

    async def delete_account(self, username: str, password: str) -> dict:
        """
        Delete user account (requires password verification)

        Args:
            username: Username to delete
            password: Password to verify

        Returns:
            Dictionary with success status
        """
        user_doc = await self.users_collection.find_one({"username": username})

        if not user_doc:
            return {"success": False, "error": "User not found"}

        # Verify password before deletion
        if not verify_password(password, user_doc["hashed_password"]):
            await self.audit_logger.log_event("account_deletion_failed", username, False,
                                              details="Incorrect password")
            return {"success": False, "error": "Incorrect password"}

        # Delete the user account
        await self.users_collection.delete_one({"_id": user_doc["_id"]})

        await self.audit_logger.log_event("account_deleted", username, True)

        return {"success": True, "message": "Account deleted successfully"}

    async def set_user_role(self, username: str, role: str) -> dict:
        """
        Set user role (admin only)

        Args:
            username: Username to update
            role: New role (user or admin)

        Returns:
            Dictionary with success status
        """
        if role not in ["user", "admin"]:
            return {"success": False, "error": "Invalid role. Must be 'user' or 'admin'"}

        user_doc = await self.users_collection.find_one({"username": username})

        if not user_doc:
            return {"success": False, "error": "User not found"}

        await self.users_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"role": role, "last_activity": datetime.utcnow()}}
        )

        await self.audit_logger.log_event("role_changed", username, True,
                                          details=f"Role changed to {role}")

        return {"success": True, "message": f"User role set to {role}"}

    async def get_user_audit_log(self, username: str, limit: int = 50) -> dict:
        """
        Get audit log for a user

        Args:
            username: Username to get logs for
            limit: Maximum number of log entries

        Returns:
            Dictionary with audit log entries
        """
        events = await self.audit_logger.get_user_events(username, limit)
        return {
            "success": True,
            "username": username,
            "events": events
        }

    async def close(self):
        """Close database connection"""
        self.client.close()
