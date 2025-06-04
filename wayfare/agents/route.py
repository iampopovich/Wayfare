from typing import Dict, Any, List, Optional
from agents.base import BaseAgent, AgentResponse
from wayfare.repositories.maps.google_maps import GoogleMapsRepository
from wayfare.models.location import Location
from wayfare.core.settings import get_settings
import logging

logger = logging.getLogger(__name__)


class RouteAgent(BaseAgent):
    def _setup_chain(self):
        template = """
        You are a route planning expert. Plan the optimal route considering:
        - Start point: {start_point}
        - End point: {end_point}
        - Transportation type: {transportation_type}
        - Waypoints: {waypoints}
        - Time constraints: {time_constraints}
        - Additional preferences: {preferences}

        Consider traffic patterns, road conditions, and optimal routes.
        """
        self.chain = self._create_chain(
            template=template,
            input_variables=[
                "start_point",
                "end_point",
                "transportation_type",
                "waypoints",
                "time_constraints",
                "preferences",
            ],
        )

    async def process(self, **kwargs) -> Dict[str, Any]:
        try:
            route_data = await self._plan_route(**kwargs)
            return AgentResponse(success=True, data=route_data, error=None).to_dict()
        except Exception as e:
            return AgentResponse(success=False, data={}, error=str(e)).to_dict()

    async def _plan_route(
        self,
        start_point: str,  # Expected format: "latitude,longitude"
        end_point: str,  # Expected format: "latitude,longitude"
        transportation_type: str = "driving",
        waypoints: Optional[List[str]] = None,  # List of "lat,lng" strings
        alternatives: bool = False,  # Changed default to False to usually get one optimal route
        **kwargs,  # To accommodate other parameters like time_constraints, preferences if needed later
    ) -> Dict[str, Any]:
        """
        Plans a route using Google Maps API.
        kwargs:
            start_point (str): "latitude,longitude"
            end_point (str): "latitude,longitude"
            transportation_type (str): "driving", "walking", "bicycling", "transit"
            waypoints (Optional[List[str]]): List of "latitude,longitude" strings for waypoints.
            alternatives (bool): Whether to return alternative routes.
        """
        try:
            logger.info(
                f"Planning route from '{start_point}' to '{end_point}' using {transportation_type}."
            )
            app_settings = get_settings()
            maps_repo = GoogleMapsRepository(api_key=app_settings.GOOGLE_MAPS_API_KEY)

            try:
                origin_lat, origin_lng = map(float, start_point.split(','))
                destination_lat, destination_lng = map(float, end_point.split(','))
            except ValueError as e:
                logger.error(f"Invalid coordinate format: {e}")
                raise ValueError("Invalid start_point or end_point format. Expected 'latitude,longitude'.") from e

            origin_loc = Location(latitude=origin_lat, longitude=origin_lng)
            destination_loc = Location(latitude=destination_lat, longitude=destination_lng)

            parsed_waypoints: Optional[List[Location]] = None
            if waypoints:
                parsed_waypoints = []
                for wp_str in waypoints:
                    try:
                        wp_lat, wp_lng = map(float, wp_str.split(','))
                        parsed_waypoints.append(Location(latitude=wp_lat, longitude=wp_lng))
                    except ValueError as e:
                        logger.error(f"Invalid waypoint format '{wp_str}': {e}")
                        raise ValueError(f"Invalid waypoint format '{wp_str}'. Expected 'latitude,longitude'.") from e

            # Ensure transportation_type is one of the allowed values by Google Maps
            allowed_modes = ["driving", "walking", "bicycling", "transit"]
            if transportation_type not in allowed_modes:
                logger.warning(
                    f"Unsupported transportation_type: {transportation_type}. Defaulting to 'driving'."
                )
                transportation_type = "driving"

            route_result = await maps_repo.get_directions(
                origin=origin_loc,
                destination=destination_loc,
                mode=transportation_type,
                waypoints=parsed_waypoints,
                alternatives=alternatives,
            )
            # The get_directions method returns a Route object.
            # The get_directions method returns a Route Pydantic model.
            # Convert it to a dict to match the method's type hint Dict[str, Any].
            # model_dump() is for Pydantic v2, dict() for Pydantic v1.
            # The Route model is likely Pydantic v2 if 'model_dump' was suggested before.
            if hasattr(route_result, 'model_dump'):
                return route_result.model_dump(exclude_none=True) # Exclude_none for cleaner output
            elif hasattr(route_result, 'dict'): # Fallback for Pydantic v1
                return route_result.dict(exclude_none=True)
            else:
                # This case should ideally not be reached if Route is a Pydantic model.
                logger.error("Route result is not a Pydantic model, cannot convert to dict automatically.")
                raise TypeError("Route result cannot be converted to dictionary.")

        except ValueError as ve: # Handles errors from coordinate parsing or invalid transportation_type (if not caught earlier)
            logger.error(f"ValueError in route planning: {ve}", exc_info=True)
            # Re-raise to be caught by the process method's generic Exception handler or a more specific one if added.
            raise
        except DirectionsError as de: # Catching specific error from GoogleMapsRepository
            logger.error(f"DirectionsError in route planning: {de}", exc_info=True)
            raise # Re-raise to be handled by process method
        except Exception as e: # Catch-all for other unexpected errors
            logger.error(f"Unexpected error planning route: {e}", exc_info=True)
            # Wrap in a more generic exception or re-raise.
            # The process method already catches Exception and puts its string in AgentResponse.
            raise Exception(f"An unexpected error occurred during route planning: {str(e)}") from e

    async def optimize_route(
        self, route: Dict[str, Any], constraints: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Optimize route based on given constraints."""
        # Implement route optimization logic
        return route
