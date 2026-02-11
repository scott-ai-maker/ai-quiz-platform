from fastapi import APIRouter, HTTPException, Depends, Header
from src.auth.auth_service import AuthService
from src.models.user_model import (
    UserCreate, UserLogin, Token, UserResponse,
    UserProfileUpdate, PasswordResetRequest, PasswordResetConfirm
)
from src.utils.jwt_utils import verify_token
from typing import Optional

router = APIRouter(prefix="/auth", tags=["authentication"])
auth_service = None


async def get_auth_service():
    global auth_service
    if auth_service is None:
        auth_service = AuthService()
    return auth_service

# Dependency to get current user from token


async def get_current_user(authorization: Optional[str] = Header(None)) -> UserResponse:
    """
    Get current user from JWT token

    Args:
        authorization: Authorization header with Bearer token

    Returns:
        UserResponse object

    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    token_data = verify_token(token)

    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    service = await get_auth_service()
    user = await service.get_user_by_username(token_data.username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(**user.dict())


async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """
    Verify current user is an admin

    Args:
        current_user: Current authenticated user

    Returns:
        UserResponse object if admin

    Raises:
        HTTPException: If user is not an admin
    """
    # Get the full user with role info
    service = await get_auth_service()
    user = await service.get_user_by_username(current_user.username)

    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return current_user


@router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    """
    Register a new user

    Args:
        user_data: User registration information

    Returns:
        Success message with user data

    Raises:
        HTTPException: If registration fails
    """
    service = await get_auth_service()
    result = await service.create_user(user_data)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {
        "message": result["message"],
        "user": result["user"]
    }


@router.post("/login", response_model=dict)
async def login(login_data: UserLogin):
    """
    Login user and return JWT token

    Args:
        login_data: User login credentials

    Returns:
        JWT token and user information

    Raises:
        HTTPException: If login fails
    """
    service = await get_auth_service()
    result = await service.authenticate_user(login_data)

    if not result["success"]:
        raise HTTPException(status_code=401, detail=result["error"])

    return {
        "access_token": result["access_token"],
        "token_type": result["token_type"],
        "expires_in": result["expires_in"],
        "user": result["user"]
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """
    Get current authenticated user information

    Args:
        current_user: Current user from JWT token

    Returns:
        Current user information
    """
    return current_user


@router.put("/profile", response_model=dict)
async def update_profile(
    profile_data: UserProfileUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update user profile (email or full name)

    Args:
        profile_data: Profile update data
        current_user: Current authenticated user

    Returns:
        Updated user information

    Raises:
        HTTPException: If update fails
    """
    service = await get_auth_service()
    result = await service.update_user_profile(current_user.username, profile_data)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"message": result["message"], "user": result["user"]}


@router.delete("/account", response_model=dict)
async def delete_account(
    password: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Delete user account (requires password verification)

    Args:
        password: User password for verification
        current_user: Current authenticated user

    Returns:
        Success message

    Raises:
        HTTPException: If deletion fails
    """
    service = await get_auth_service()
    result = await service.delete_account(current_user.username, password)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"message": result["message"]}


@router.post("/forgot-password", response_model=dict)
async def forgot_password(request: PasswordResetRequest):
    """
    Request a password reset token

    Args:
        request: Password reset request with email

    Returns:
        Success message (doesn't reveal if email exists)

    Note:
        In production, the reset token should be sent via email,
        not returned in the response
    """
    service = await get_auth_service()
    result = await service.request_password_reset(request.email)

    return {
        "message": result["message"],
        "reset_token": result.get("reset_token")  # In production, remove this
    }


@router.post("/reset-password", response_model=dict)
async def reset_password(reset_data: PasswordResetConfirm):
    """
    Reset password using reset token

    Args:
        reset_data: Password reset data with token and new password

    Returns:
        Success message

    Raises:
        HTTPException: If reset fails
    """
    service = await get_auth_service()
    result = await service.reset_password(reset_data)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"message": result["message"]}


@router.get("/audit-log", response_model=dict)
async def get_audit_log(
    limit: int = 50,
    admin_user: UserResponse = Depends(get_admin_user)
):
    """
    Get audit log for the current user (account activity)

    Args:
        limit: Maximum number of log entries to return
        admin_user: Current authenticated admin user

    Returns:
        Audit log entries

    Raises:
        HTTPException: If user is not admin
    """
    service = await get_auth_service()
    result = await service.get_user_audit_log(admin_user.username, limit)

    return result


@router.post("/admin/set-role", response_model=dict)
async def set_user_role(
    username: str,
    role: str,
    admin_user: UserResponse = Depends(get_admin_user)
):
    """
    Set user role (admin only)

    Args:
        username: Username to update
        role: New role (user or admin)
        admin_user: Current authenticated admin user

    Returns:
        Success message

    Raises:
        HTTPException: If user is not admin or role update fails
    """
    service = await get_auth_service()
    result = await service.set_user_role(username, role)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"message": result["message"]}


@router.get("/health")
async def health_check():
    """
    Health check endpoint

    Returns:
        Service health status
    """
    return {
        "status": "healthy",
        "service": "auth-service",
        "version": "1.0.0"
    }
