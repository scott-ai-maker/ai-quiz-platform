import pytest
import asyncio
from datetime import datetime, timedelta
from src.utils.password_utils import hash_password, verify_password, validate_password_strength
from src.utils.jwt_utils import create_access_token, verify_token
from src.auth.auth_service import AuthService
from src.models.user_model import UserCreate, UserLogin, UserProfileUpdate, PasswordResetConfirm


class TestPasswordUtils:
    """Test password utility functions"""

    def test_password_hashing(self):
        """Test password hashing and verification"""
        password = "TestPassword123!"
        hashed = hash_password(password)

        # Hash should not equal original password
        assert hashed != password

        # Verification should work
        assert verify_password(password, hashed) is True

        # Wrong password should fail
        assert verify_password("WrongPassword", hashed) is False

    def test_password_strength_validation(self):
        """Test password strength validation"""
        # Valid password
        is_valid, message = validate_password_strength("StrongPass123!")
        assert is_valid is True

        # Too short
        is_valid, message = validate_password_strength("Short1!")
        assert is_valid is False
        assert "8 characters" in message

        # No uppercase
        is_valid, message = validate_password_strength("weakpass123!")
        assert is_valid is False
        assert "uppercase" in message

        # No lowercase
        is_valid, message = validate_password_strength("WEAKPASS123!")
        assert is_valid is False
        assert "lowercase" in message

        # No number
        is_valid, message = validate_password_strength("WeakPassword!")
        assert is_valid is False
        assert "number" in message

        # No special character
        is_valid, message = validate_password_strength("WeakPassword123")
        assert is_valid is False
        assert "special character" in message


class TestJWTUtils:
    """Test JWT utility functions"""

    def test_create_and_verify_token(self):
        """Test JWT token creation and verification"""
        data = {"sub": "testuser", "user_id": "12345"}
        token = create_access_token(data)

        # Token should be created
        assert token is not None
        assert len(token) > 0

        # Token should be verifiable
        token_data = verify_token(token)
        assert token_data is not None
        assert token_data.username == "testuser"
        assert token_data.user_id == "12345"

    def test_invalid_token(self):
        """Test invalid token verification"""
        token_data = verify_token("invalid.token.here")
        assert token_data is None


class TestAccountLockout:
    """Test account lockout and brute force protection"""

    @pytest.mark.asyncio
    async def test_failed_login_attempts(self):
        """Test that failed login attempts are tracked"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="StrongPass123!",
            full_name="Test User"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Simulate failed login attempts
        for i in range(3):
            login_data = UserLogin(username="testuser",
                                   password="WrongPassword123!")
            result = await service.authenticate_user(login_data)
            assert result["success"] is False
            assert "Invalid username or password" in result["error"]

        await service.close()

    @pytest.mark.asyncio
    async def test_account_lockout_after_max_attempts(self):
        """Test that account locks after max failed attempts"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="locktest",
            email="locktest@example.com",
            password="StrongPass123!",
            full_name="Lock Test User"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Simulate max failed login attempts
        for i in range(service.MAX_LOGIN_ATTEMPTS):
            login_data = UserLogin(username="locktest",
                                   password="WrongPassword123!")
            result = await service.authenticate_user(login_data)
            assert result["success"] is False

        # Next attempt should be locked
        login_data = UserLogin(username="locktest", password="StrongPass123!")
        result = await service.authenticate_user(login_data)
        assert result["success"] is False
        assert "locked" in result["error"].lower()

        await service.close()

    @pytest.mark.asyncio
    async def test_successful_login_resets_attempts(self):
        """Test that successful login resets failed attempt counter"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="resettest",
            email="resettest@example.com",
            password="StrongPass123!",
            full_name="Reset Test User"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # One failed attempt
        login_data = UserLogin(username="resettest",
                               password="WrongPassword123!")
        result = await service.authenticate_user(login_data)
        assert result["success"] is False

        # Successful login should reset counter
        login_data = UserLogin(username="resettest", password="StrongPass123!")
        result = await service.authenticate_user(login_data)
        assert result["success"] is True
        assert result["access_token"] is not None

        await service.close()


class TestPasswordReset:
    """Test password reset functionality"""

    @pytest.mark.asyncio
    async def test_password_reset_request(self):
        """Test password reset token generation"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="resetuser",
            email="resetuser@example.com",
            password="StrongPass123!",
            full_name="Reset User"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Request password reset
        result = await service.request_password_reset("resetuser@example.com")
        assert result["success"] is True
        assert "reset_token" in result

        await service.close()

    @pytest.mark.asyncio
    async def test_password_reset_with_valid_token(self):
        """Test resetting password with valid token"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="resetuser2",
            email="resetuser2@example.com",
            password="StrongPass123!",
            full_name="Reset User 2"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Request password reset
        result = await service.request_password_reset("resetuser2@example.com")
        reset_token = result["reset_token"]

        # Reset password with token
        reset_data = PasswordResetConfirm(
            token=reset_token,
            new_password="NewStrongPass123!"
        )
        result = await service.reset_password(reset_data)
        assert result["success"] is True

        # Should be able to login with new password
        login_data = UserLogin(username="resetuser2",
                               password="NewStrongPass123!")
        result = await service.authenticate_user(login_data)
        assert result["success"] is True
        assert result["access_token"] is not None

        await service.close()

    @pytest.mark.asyncio
    async def test_password_reset_with_invalid_password_strength(self):
        """Test password reset rejects weak passwords"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="resetuser3",
            email="resetuser3@example.com",
            password="StrongPass123!",
            full_name="Reset User 3"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Request password reset
        result = await service.request_password_reset("resetuser3@example.com")
        reset_token = result["reset_token"]

        # Try to reset with weak password
        reset_data = PasswordResetConfirm(
            token=reset_token,
            new_password="weak"  # Too short
        )
        result = await service.reset_password(reset_data)
        assert result["success"] is False
        assert "password" in result["error"].lower()

        await service.close()


class TestProfileManagement:
    """Test user profile management"""

    @pytest.mark.asyncio
    async def test_update_user_profile(self):
        """Test updating user profile"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="profileuser",
            email="profile@example.com",
            password="StrongPass123!",
            full_name="Original Name"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Update profile
        profile_data = UserProfileUpdate(
            full_name="Updated Name",
            email="newemail@example.com"
        )
        result = await service.update_user_profile("profileuser", profile_data)
        assert result["success"] is True
        assert result["user"]["full_name"] == "Updated Name"
        assert result["user"]["email"] == "newemail@example.com"

        await service.close()

    @pytest.mark.asyncio
    async def test_delete_account(self):
        """Test account deletion with password verification"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="deleteuser",
            email="delete@example.com",
            password="StrongPass123!",
            full_name="Delete User"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Delete account with correct password
        result = await service.delete_account("deleteuser", "StrongPass123!")
        assert result["success"] is True

        # User should no longer exist
        user = await service.get_user_by_username("deleteuser")
        assert user is None

        await service.close()

    @pytest.mark.asyncio
    async def test_delete_account_wrong_password(self):
        """Test that account deletion fails with wrong password"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="deleteuser2",
            email="delete2@example.com",
            password="StrongPass123!",
            full_name="Delete User 2"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Try to delete with wrong password
        result = await service.delete_account("deleteuser2", "WrongPassword123!")
        assert result["success"] is False
        assert "Incorrect password" in result["error"]

        # User should still exist
        user = await service.get_user_by_username("deleteuser2")
        assert user is not None

        await service.close()


class TestRoleManagement:
    """Test user role management"""

    @pytest.mark.asyncio
    async def test_set_user_role(self):
        """Test setting user role"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="roleuser",
            email="role@example.com",
            password="StrongPass123!",
            full_name="Role User"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Promote to admin
        result = await service.set_user_role("roleuser", "admin")
        assert result["success"] is True

        # Verify role was set
        user = await service.get_user_by_username("roleuser")
        assert user.role == "admin"

        # Demote back to user
        result = await service.set_user_role("roleuser", "user")
        assert result["success"] is True

        user = await service.get_user_by_username("roleuser")
        assert user.role == "user"

        await service.close()

    @pytest.mark.asyncio
    async def test_invalid_role(self):
        """Test that invalid roles are rejected"""
        service = AuthService()

        # Register a user
        user_data = UserCreate(
            username="roleuser2",
            email="role2@example.com",
            password="StrongPass123!",
            full_name="Role User 2"
        )
        result = await service.create_user(user_data)
        assert result["success"] is True

        # Try to set invalid role
        result = await service.set_user_role("roleuser2", "superadmin")
        assert result["success"] is False
        assert "Invalid role" in result["error"]

        await service.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
