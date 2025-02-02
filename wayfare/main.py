from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

from wayfare.api.v1 import maps, travel
from wayfare.core.settings import settings

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Wayfare API",
    description="API for integrating with various mapping and travel services",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(maps.router, prefix="/api/v1")
app.include_router(travel.router, prefix="/api/v1")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for all unhandled exceptions."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc)
        }
    )

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }

@app.get("/api/v1")
async def api_version():
    """API version information."""
    return {
        "version": "1.0.0",
        "name": "Wayfare API",
        "endpoints": {
            "maps": "/api/v1/maps",
            "travel": "/api/v1/travel"
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "wayfare.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development"
    )
