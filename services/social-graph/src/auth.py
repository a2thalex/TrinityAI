"""
Authentication and Authorization
"""

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Validate authentication token"""
    token = credentials.credentials

    # Simple token validation - in production use proper JWT
    if token != os.getenv("ADMIN_API_KEY", "admin-secret-key"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token