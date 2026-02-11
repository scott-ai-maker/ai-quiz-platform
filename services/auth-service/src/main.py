from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from src.auth.routes import router as auth_router, get_auth_service
import uvicorn
import os
import asyncio
import sys

# Create FastAPI application
app = FastAPI(
    title="AI Quiz Platform - Authentication Service",
    description="Secure authentication service with JWT tokens and bcrypt password hashing",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include authentication routes
app.include_router(auth_router)

# Startup event


@app.on_event("startup")
async def startup():
    """Log startup - database initialization will happen on first request"""
    print("✅ Authentication service started", file=sys.stdout, flush=True)
    print("📚 API Documentation: http://localhost:8000/docs", file=sys.stdout, flush=True)
    print("📚 Interactive API Docs: http://localhost:8000/docs", file=sys.stdout, flush=True)
    # Initialize database from get_auth_service will handle retries lazily


# Shutdown event


@app.on_event("shutdown")
async def shutdown():
    """Close database connection on shutdown"""
    service = await get_auth_service()
    await service.close()
    print("👋 Authentication service stopped", file=sys.stdout, flush=True)

# Serve static files (frontend)
try:
    app.mount("/static", StaticFiles(directory="frontend"), name="static")
except:
    pass  # Frontend directory might not exist yet


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the frontend application or API info"""
    try:
        with open("frontend/index.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Quiz Platform - Auth Service</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 30px;
                    border-radius: 10px;
                    backdrop-filter: blur(10px);
                }
                h1 { margin-top: 0; }
                a {
                    color: #ffd700;
                    text-decoration: none;
                    font-weight: bold;
                }
                a:hover { text-decoration: underline; }
                .endpoint {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔐 AI Quiz Platform - Authentication Service</h1>
                <p>Production-ready authentication service running!</p>
                
                <h2>🚀 Quick Links:</h2>
                <div class="endpoint">
                    📖 <a href="/docs">Interactive API Documentation</a>
                </div>
                <div class="endpoint">
                    ❤️ <a href="/auth/health">Health Check</a>
                </div>
                
                <h2>📡 Available Endpoints:</h2>
                <ul>
                    <li><strong>POST /auth/register</strong> - Create new user account</li>
                    <li><strong>POST /auth/login</strong> - Authenticate and get JWT token</li>
                    <li><strong>GET /auth/me</strong> - Get current user info (requires token)</li>
                    <li><strong>GET /auth/health</strong> - Service health check</li>
                </ul>
                
                <h2>🔧 Features:</h2>
                <ul>
                    <li>✅ JWT-based authentication</li>
                    <li>✅ Bcrypt password hashing</li>
                    <li>✅ Password strength validation</li>
                    <li>✅ MongoDB integration</li>
                    <li>✅ Async/await support</li>
                </ul>
            </div>
        </body>
        </html>
        """)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
