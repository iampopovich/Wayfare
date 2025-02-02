from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import os
from dotenv import load_dotenv
import logging
import time
from wayfare.core.logging import setup_logging
import uvicorn

# Load environment variables from .env file
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

from wayfare.api.dependencies import get_maps_service, get_travel_service
from wayfare.api.v1 import maps, travel

app = FastAPI(title="Wayfare API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and their processing time."""
    start_time = time.time()
    
    # Get request details
    path = request.url.path
    method = request.method
    
    try:
        # Get request body for specific endpoints
        if path.endswith("/route"):
            body = await request.json()
            logger.info(f"Request {method} {path} - Body: {body}")
        else:
            logger.info(f"Request {method} {path}")
        
        response = await call_next(request)
        
        # Log processing time
        process_time = time.time() - start_time
        logger.info(f"Request completed - {method} {path} - Took {process_time:.2f}s - Status {response.status_code}")
        
        return response
        
    except Exception as e:
        logger.error(f"Error processing request {method} {path}: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

# Mount static files
app.mount("/static", StaticFiles(directory="wayfare/static"), name="static")

# Include routers
app.include_router(maps.router, prefix="/api/v1/maps", tags=["maps"])
app.include_router(travel.router, prefix="/api/v1/travel", tags=["travel"])

@app.get("/")
async def root():
    """Serve the main application page."""
    return FileResponse("wayfare/static/index.html")

@app.get("/api/v1")
async def api_welcome():
    """API welcome endpoint with available routes."""
    return JSONResponse({
        "message": "Welcome to Wayfare API v1.0",
        "version": "1.0.0",
        "endpoints": {
            "maps": {
                "search": "/api/v1/maps/search",
                "place_details": "/api/v1/maps/place/{place_id}",
                "directions": "/api/v1/maps/directions"
            },
            "travel": {
                "plan_route": "/api/v1/travel/route"
            }
        },
        "documentation": "/docs",
        "openapi": "/openapi.json"
    })

PORT = int(os.getenv('PORT', 8000))

if __name__ == "__main__":
    uvicorn.run(
        "wayfare.main:app",
        host="0.0.0.0",
        port=PORT,
        reload=True
    )
