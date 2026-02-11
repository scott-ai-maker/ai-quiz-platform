from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Annotated
from datetime import datetime
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic models"""
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, handler):
        from pydantic_core import core_schema

        return core_schema.no_info_after_validator_function(
            lambda v: cls(v),
            core_schema.str_schema(),
        )

    @classmethod
    def __get_pydantic_json_schema__(cls, schema, _handler):
        schema.update(type="string")
        return schema


class UserCreate(BaseModel):
    """User registration model"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    """User login model"""
    username: str
    password: str


class UserResponse(BaseModel):
    """User response model (without sensitive data)"""
    id: str = Field(alias="_id")  # Use string directly instead of PyObjectId
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
    )


class PasswordResetToken(BaseModel):
    """Password reset token model"""
    token: str
    created_at: datetime
    expires_at: datetime
    used: bool = False


class UserInDB(UserResponse):
    """User model as stored in database"""
    hashed_password: str
    role: str = "user"  # "user" or "admin"
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    password_reset_tokens: list[PasswordResetToken] = []
    is_2fa_enabled: bool = False
    two_factor_secret: Optional[str] = None
    last_activity: Optional[datetime] = None


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Token payload data"""
    username: Optional[str] = None
    user_id: Optional[str] = None


class UserProfileUpdate(BaseModel):
    """User profile update model"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordResetRequest(BaseModel):
    """Password reset request model"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model"""
    token: str
    new_password: str = Field(..., min_length=8)


class AuditLogEntry(BaseModel):
    """Audit log entry for security events"""
    event_type: str  # "login", "failed_login", "password_reset", "role_change", etc.
    username: str
    timestamp: datetime
    ip_address: Optional[str] = None
    success: bool = True
    details: Optional[str] = None
