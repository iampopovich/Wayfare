import logging
from fastapi import APIRouter, HTTPException, Depends
from wayfare.services.travel import TravelService
from wayfare.api.dependencies import get_travel_service
from wayfare.models.travel import TravelRequest, TravelResponse

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/route")
async def plan_route(
    request: TravelRequest,
    travel_service: TravelService = Depends(get_travel_service)
):
    """
    Plan a route with transportation options.
    """
    try:
        logger.info(f"Received travel request: origin={request.origin}, destination={request.destination}, "
                   f"transport={request.transportation_type}, passengers={request.passengers}")
        
        result = await travel_service.plan_travel(request)
        
        logger.info(f"Successfully planned route from {request.origin} to {request.destination}")
        return result
        
    except ValueError as e:
        logger.error(f"Validation error in travel request: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing travel request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error while planning route")
