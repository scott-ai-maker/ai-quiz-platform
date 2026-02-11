from src.models.user_model import UserCreate
from src.auth.auth_service import AuthService
import asyncio
import sys
sys.path.insert(0, '.')


async def test():
    service = AuthService()

    # Test user registration
    user_data = UserCreate(
        username="test_user_direct",
        email="test_direct@example.com",
        password="TestPass123!",
        full_name="Test User"
    )

    result = await service.create_user(user_data)
    print("Registration result:", result)

    await service.close()

asyncio.run(test())
