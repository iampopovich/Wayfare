from typing import List, Tuple, Dict, Any # Added Dict, Any
import polyline # polyline is used in google_maps.py, not directly here. Consider removing if not used.
                # On second check, polyline is NOT used in this file. Will remove.
from models.travel import TravelRequest, TravelResponse, TransportationType
from models.route import Route # RouteSegment not used directly here.
# from models.location import Location # Location model is used by maps_repository, not directly constructed here beyond what maps_repo returns.
from models.stops import Stop
from models.costs import Cost
from models.health import Health
from models.vehicle import TransportCosts, CarSpecifications, MotorcycleSpecifications
from repositories.maps.google_maps import GoogleMapsRepository
from repositories.weather.open_weather_map import WeatherRepository
from agents.stops import StopsAgent
from agents.fuel import FuelPriceAgent
from agents.transport_prices import TransportPriceAgent
from agents.weather import WeatherAgent
from services.search import SearchService
import logging
import aiohttp
import asyncio
from math import ceil

logger = logging.getLogger(__name__)


class TravelService:
    # Google Maps supported travel modes
    TRANSPORT_MODE_MAPPING = {
        TransportationType.CAR: "driving",
        TransportationType.MOTORCYCLE: "driving",  # Motorcycles use the same mode as cars
        TransportationType.WALKING: "walking",
        TransportationType.BICYCLE: "bicycling",
        TransportationType.BUS: "transit",
        TransportationType.TRAIN: "transit",
    }

    # Average fuel prices by type (USD per liter)
    FUEL_PRICES = {
        "gasoline": 1.2,
        "diesel": 1.1,
        "electric": 0.15,  # Price per kWh
        "92": 1.1,  # Regular octane
        "95": 1.25,  # Premium octane
        "98": 1.4,  # Super octane
    }

    def __init__(
        self,
        maps_repository: GoogleMapsRepository,
        weather_repository: WeatherRepository,
        search_service: SearchService,
    ):
        self.maps_repository = maps_repository
        self.weather_repository = weather_repository
        self.search_service = search_service
        self.stops_agent = StopsAgent()
        self.fuel_agent = FuelPriceAgent()
        self.transport_price_agent = TransportPriceAgent(search_service)
        self.weather_agent = WeatherAgent(weather_repository=weather_repository)

    def _get_google_maps_mode(self, transport_type: TransportationType) -> str:
        """Convert our transport type to Google Maps travel mode."""
        mode = self.TRANSPORT_MODE_MAPPING.get(transport_type)
        if not mode:
            raise ValueError(
                f"Unsupported transportation type: {transport_type}. "
                f"Supported types are: {', '.join(self.TRANSPORT_MODE_MAPPING.keys())}"
            )
        return mode

    async def _calculate_transport_costs(
        self,
        distance_meters: float,
        duration_minutes: float,
        transport_type: TransportationType,
        request: TravelRequest,
    ) -> TransportCosts:
        """Calculate transport costs based on mode and distance."""
        logger.info(
            f"Calculating costs for {transport_type}, distance={distance_meters/1000:.1f}km, duration={duration_minutes:.0f}min"
        )

        costs = TransportCosts(total_cost=0, currency="USD")

        # Basic food and water costs for long trips (over 2 hours)
        if duration_minutes > 120:
            costs.food_cost = 10 * (duration_minutes / 60)  # $10 per hour for food
            costs.water_cost = 2 * (duration_minutes / 60)  # $2 per hour for water

        # Calculate accommodation costs if overnight stay is needed (over 16 hours)
        if duration_minutes > 960:
            if request.overnight_stay and request.overnight_stay.max_price_per_night is not None: # Check for None
                costs.accommodation_cost = request.overnight_stay.max_price_per_night
            else: # Default if not specified or max_price_per_night is None
                costs.accommodation_cost = 100.0  # Default $100 per night, use float

        # Calculate transport-specific costs
        distance_km = distance_meters / 1000.0 # Use float for division

        if transport_type == TransportationType.CAR and request.car_specifications:
            self._calculate_car_costs(costs, distance_km, request.car_specifications)
        elif transport_type == TransportationType.MOTORCYCLE and request.motorcycle_specifications:
            self._calculate_motorcycle_costs(costs, distance_km, request.motorcycle_specifications)
        elif transport_type in [TransportationType.BUS, TransportationType.TRAIN]:
            ticket_price = await self.transport_price_agent.get_ticket_price(
                transport_type, request.origin, request.destination
            )
            costs.ticket_cost = ticket_price * request.passengers

        # Sum up all cost components
        costs.total_cost = sum(
            cost for cost in [
                costs.fuel_cost,
                costs.ticket_cost,
                costs.food_cost,
                costs.water_cost,
                costs.accommodation_cost,
                costs.maintenance_cost,
            ] if cost is not None
        )
        return costs

    async def _find_gas_stations_along_route(
        self, route_points: List[Tuple[float, float]], search_radius_meters: int = 5000
    ) -> List[Dict[str, Any]]: # Return type hint improved
        """Find gas stations near route points using OpenStreetMap Overpass API."""
        if not route_points:
            logger.info("No route points provided for gas station search.")
            return []

        logger.info(f"Finding gas stations along {len(route_points)} route points, radius: {search_radius_meters}m.")
        gas_stations: List[Dict[str, Any]] = [] # Explicit type hint
        overpass_url = "https://overpass-api.de/api/interpreter"

        # Create one session for all requests
        async with aiohttp.ClientSession() as session:
            # Optimized query: search around multiple points in one go if API supports it,
            # or batch points. For now, sequential with a small delay.
            # A single large query for all points might be too complex or hit limits.
            # The loop processes a few points at a time or one by one with delay.
            for i, (lat, lon) in enumerate(route_points):
                # Log every few points to avoid excessive logging for long routes
                if i % 10 == 0: # Log every 10th point
                    logger.info(
                        f"Searching for gas stations near route point {i+1}/{len(route_points)} ({lat:.4f},{lon:.4f})"
                    )

                # Overpass QL query to find gas stations ("amenity=fuel")
                # Using `nwr` (node, way, relation) for a broader search.
                query = f"""
                [out:json][timeout:25];
                (
                  nwr["amenity"="fuel"](around:{search_radius_meters},{lat},{lon});
                );
                out center;
                """
                try:
                    async with session.post(overpass_url, data={"data": query}) as response: # data param for Overpass
                        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                        data = await response.json()

                        found_count = 0
                        for element in data.get("elements", []):
                            station_lat, station_lon = 0.0, 0.0
                            if element["type"] == "node":
                                station_lat, station_lon = element.get("lat", 0.0), element.get("lon", 0.0)
                            elif "center" in element:  # For ways/relations, use center coordinates
                                station_lat, station_lon = element["center"].get("lat", 0.0), element["center"].get("lon", 0.0)
                            else:
                                continue # Skip if no coordinates found

                            if station_lat == 0.0 and station_lon == 0.0: # Basic check
                                continue

                            tags = element.get("tags", {})
                            gas_stations.append({
                                "location": {"latitude": station_lat, "longitude": station_lon},
                                "name": tags.get("name", "Gas Station"),
                                "brand": tags.get("brand", "Unknown"),
                                "amenities": ["fuel"] + ([k for k,v in tags.items() if k in ["toilets", "shop", "car_wash"] and v == "yes"]),
                                "source_id": element.get("id") # Store original ID
                            })
                            found_count +=1
                        if found_count > 0:
                            logger.debug(f"Found {found_count} stations near point {i+1}")
                except aiohttp.ClientError as e: # More specific exception for network/HTTP issues
                    logger.warning(
                        f"aiohttp.ClientError finding gas stations near point {i+1} ({lat:.4f},{lon:.4f}): {e}"
                    )
                except Exception as e: # Catch other potential errors like JSON parsing
                    logger.error(
                        f"Unexpected error finding gas stations near point {i+1} ({lat:.4f},{lon:.4f}): {e}", exc_info=True
                    )

                # Rate limiting: Be respectful to the public Overpass API.
                # Consider making this configurable or using a more sophisticated rate limiter.
                if len(route_points) > 1: # Avoid sleep if only one point
                    await asyncio.sleep(1) # Sleep for 1 second between requests.

        logger.info(f"Found a total of {len(gas_stations)} gas station entries along the route.")
        # Deduplicate stations based on source_id if multiple queries return the same station
        unique_stations = {station['source_id']: station for station in gas_stations if station.get('source_id')}
        logger.info(f"Found {len(unique_stations)} unique gas stations after deduplication.")
        return gas_stations

    async def plan_travel(self, request: TravelRequest) -> TravelResponse:
        """Plan a travel route with all necessary details using Google Maps."""
        try:
            logger.info(
                f"Planning travel from {request.origin} to {request.destination}"
            )
            logger.info(f"Transportation type: {request.transportation_type}")
            if request.car_specifications:
                logger.info(f"Car specs: {request.car_specifications}")
            if request.motorcycle_specifications:
                logger.info(f"Motorcycle specs: {request.motorcycle_specifications}")

            # First, geocode the origin and destination
            logger.info(
                f"Geocoding locations: {request.origin} -> {request.destination}"
            )

            origin_location = await self.maps_repository.geocode(request.origin)
            destination_location = await self.maps_repository.geocode(
                request.destination
            )

            logger.info(
                f"Geocoded locations: {origin_location} -> {destination_location}"
            )

            # Convert transport type to Google Maps mode
            mode = self._get_google_maps_mode(request.transportation_type)
            logger.info(f"Using Google Maps travel mode: {mode}")

            # Get route from Google Maps
            logger.info("Requesting route from Google Maps")
            route = await self.maps_repository.get_directions(
                origin=origin_location, destination=destination_location, mode=mode
            )
            logger.info(f"Received route from Google Maps with {len(route.segments)} segments.")

            # Extract key points from the route for gas station search (e.g., every X km or every Nth point)
            # For simplicity, let's take start of each segment. For long segments, this might be sparse.
            # A better approach would be to use route.path_points if available and sufficiently detailed,
            # or interpolate points along longer segments.
            # Assuming route.path_points contains a list of (lat, lon) tuples from GoogleMapsRepository.
            key_route_points: List[Tuple[float, float]] = []
            if route.path_points: # path_points is List[Tuple[float,float]]
                # Select points from path_points, e.g., every 10th point or points at certain distance intervals
                # This example takes up to 20 points spread across the path_points list.
                if len(route.path_points) <= 20:
                    key_route_points = route.path_points
                else:
                    step = len(route.path_points) // 20
                    key_route_points = route.path_points[::step]
                logger.info(f"Using {len(key_route_points)} points from decoded polyline for gas station search.")
            elif route.segments: # Fallback to segment start/end points if path_points is empty
                 for segment in route.segments:
                    key_route_points.append((segment.start_location.latitude, segment.start_location.longitude))
                 if route.segments: # Add final destination
                    key_route_points.append((route.segments[-1].end_location.latitude, route.segments[-1].end_location.longitude))
                 # Deduplicate points if segments are very short
                 key_route_points = sorted(list(set(key_route_points)))
                 logger.info(f"Using {len(key_route_points)} segment start/end points for gas station search (path_points was empty).")
            else:
                logger.warning("No route points or segments available for gas station search.")

            total_distance_km = route.total_distance / 1000.0 # total_distance is in meters
            logger.info(f"Total route distance: {total_distance_km:.1f}km.")

            gas_stations: List[Dict[str, Any]] = []
            if key_route_points:
                logger.info("Searching for gas stations along the route.")
                gas_stations = await self._find_gas_stations_along_route(key_route_points)
                logger.info(f"Found {len(gas_stations)} gas station entries (before deduplication).")
                # Deduplicate gas stations (if _find_gas_stations_along_route doesn't already)
                # This is now handled inside _find_gas_stations_along_route
            else:
                logger.info("Skipping gas station search as no key route points were extracted.")

            # Calculate stops for car and motorcycle trips
            stops = []
            if (
                request.transportation_type in [TransportationType.CAR, TransportationType.MOTORCYCLE]
                and (request.car_specifications or request.motorcycle_specifications)
            ):
                logger.info("Calculating optimal stops using StopsAgent")

                # Prepare data for StopsAgent
                vehicle_specs = {}
                if request.transportation_type == TransportationType.CAR:
                    vehicle_specs = {
                        "fuel_consumption_liter_per_100km": request.car_specifications.fuel_consumption, # Assuming L/100km
                        "tank_capacity_liters": request.car_specifications.tank_capacity,
                        "initial_fuel_liters": request.car_specifications.initial_fuel,
                        "fuel_type": request.car_specifications.fuel_type,
                    }
                elif request.transportation_type == TransportationType.MOTORCYCLE and request.motorcycle_specifications:
                    # Convert km/L to L/100km for consistency if needed by agent
                    fuel_consumption_l_100km = 100.0 / request.motorcycle_specifications.fuel_economy if request.motorcycle_specifications.fuel_economy > 0 else float('inf')
                    vehicle_specs = {
                        "fuel_consumption_liter_per_100km": fuel_consumption_l_100km,
                        "tank_capacity_liters": request.motorcycle_specifications.tank_capacity,
                        "initial_fuel_liters": request.motorcycle_specifications.initial_fuel,
                        "fuel_type": request.motorcycle_specifications.fuel_type,
                    }
                else: # Should not happen if type check is done before
                    vehicle_specs = {}


                # Prepare route_details for StopsAgent, ensuring serializable data (e.g. Pydantic models to dicts)
                # Route object itself is Pydantic, so it can be converted to dict.
                agent_route_details = route.model_dump(exclude_none=True) if hasattr(route, "model_dump") else route.dict(exclude_none=True)
                agent_route_details["gas_stations"] = gas_stations # Add found gas stations
                # StopsAgent might expect total_distance in km. Route object has it in meters.
                agent_route_details["total_distance_km"] = total_distance_km
                agent_route_details["total_duration_minutes"] = route.total_duration # Already in minutes

                # Ensure all parts of agent_route_details are serializable if it goes over JSON later
                # For direct Python calls, Pydantic models or dicts are fine.

                agent_response = await self.stops_agent.process(
                    route_details=agent_route_details,
                    transportation_type=request.transportation_type.value.lower(), # e.g. "car"
                    conditions={ # Placeholder for more detailed conditions
                        "vehicle_specifications": vehicle_specs,
                        "weather": {},  # To be filled by WeatherAgent if integrated here
                        "traffic": {},   # To be filled by a TrafficAgent if available
                    },
                    time_constraints=request.time_constraints.model_dump() if request.time_constraints else {}, # Pass time constraints
                    required_stops=request.required_stops or ["fuel", "rest"], # Use from request or default
                )

                if agent_response.get("success", False): # Check for success key
                    stops_data = agent_response.get("data", {}).get("planned_stops", [])
                    # Ensure stops_data are valid Stop models or can be converted
                    stops = [Stop(**s) if isinstance(s, dict) else s for s in stops_data if isinstance(s, (dict, Stop))]
                    logger.info(f"StopsAgent successfully planned {len(stops)} stops.")
                else:
                    logger.error(f"StopsAgent failed or returned an error: {agent_response.get('error', 'Unknown error')}")
                    stops = [] # Default to no stops if agent fails

            # Calculate transport costs
            logger.info("Calculating transport costs...")
            costs = await self._calculate_transport_costs(
                route.total_distance, # Pass total distance in meters
                route.total_duration, # Pass total duration in minutes
                request.transportation_type,
                request, # Pass the full request for car_specs etc.
            )
            logger.info(f"Calculated costs: {costs}")

            # Calculate health metrics
            logger.info("Calculating health impact")
            health = Health(
                total_calories=self._calculate_calories(
                    sum(segment.distance for segment in route.segments),
                    request.transportation_type,
                ),
                activity_breakdown={
                    request.transportation_type.value: sum(
                        segment.distance for segment in route.segments
                    )
                    * 0.1
                },
            )
            logger.info(f"Calculated health impact: {health!r}") # Use !r for repr

            # Calculate weather data
            logger.info("Fetching weather data for the route...")
            # WeatherAgent expects route_details similar to StopsAgent, ensure serializable.
            # Using the same agent_route_details as prepared for StopsAgent.
            agent_route_details_for_weather = route.model_dump(exclude_none=True) if hasattr(route, "model_dump") else route.dict(exclude_none=True)

            # If WeatherAgent needs specific points, extract them.
            # For example, weather at origin, destination, and key waypoints/midpoints.
            # The current WeatherAgent process(route=route_dict) implies it can handle full route dict.

            weather_agent_response = await self.weather_agent.process(route=agent_route_details_for_weather)
            weather_data_dict = {} # Default to empty dict
            if weather_agent_response.get("success", False):
                weather_data_dict = weather_agent_response.get("data", {})
                logger.info(f"Weather data processed successfully.") # Log content if not too verbose: {weather_data_dict!r}
            else:
                logger.warning(f"WeatherAgent failed or returned no data: {weather_agent_response.get('error', 'Unknown error')}")

            # Construct final response
            response = TravelResponse(
                route=route, # The original Route object from GoogleMapsRepository
                stops=stops, # List of Stop objects
                costs=costs, # TransportCosts object
                health=health, # Health object
                weather=weather_data_dict, # Dict from WeatherAgent
            )
            logger.info("Travel plan created successfully.")
            return response

        except (GeocodingError, DirectionsError) as map_error: # Specific errors from maps_repository
            logger.error(f"Map service error during travel planning: {map_error}", exc_info=True)
            raise ValueError(f"Failed to plan travel due to a map service error: {map_error}") from map_error
        except ValueError as ve: # Catch other ValueErrors (e.g. from _get_google_maps_mode)
            logger.error(f"Validation error during travel planning: {ve}", exc_info=True)
            raise # Re-raise to be handled by API layer (results in 400 or 422)
        except Exception as e: # Catch-all for unexpected errors
            logger.error(f"Unexpected error in plan_travel: {e}", exc_info=True)
            # This will likely result in a 500 error in the API layer.
            raise ValueError(f"An unexpected error occurred while planning travel: {e}") from e

    async def _calculate_car_costs(self, costs: TransportCosts, distance_km: float, car_specs: CarSpecifications):
        """Helper to calculate car-specific costs."""
        logger.debug(f"Calculating car costs for distance: {distance_km:.2f}km, specs: {car_specs!r}")
        # Fuel consumption in liters for the trip
        fuel_liters = (distance_km / 100.0) * car_specs.fuel_consumption # Assuming L/100km

        agent_response = await self.fuel_agent.process(fuel_type=car_specs.fuel_type, region="default")
        fuel_price_per_liter = self.FUEL_PRICES.get(car_specs.fuel_type.lower(), 1.2) # Default, ensure lowercase match
        if agent_response.get("success"):
            fuel_price_per_liter = agent_response.get("data", {}).get("price_per_liter", fuel_price_per_liter)

        costs.fuel_consumption = fuel_liters
        costs.fuel_cost = fuel_liters * fuel_price_per_liter
        costs.maintenance_cost = distance_km * 0.05  # Standard $0.05 per km

        if car_specs.tank_capacity > 0 and car_specs.fuel_consumption > 0:
            # Range on initial fuel in km
            range_on_initial_fuel_km = (car_specs.initial_fuel_liters / car_specs.fuel_consumption) * 100.0
            remaining_distance_km = distance_km - range_on_initial_fuel_km
            if remaining_distance_km > 0:
                # Range per full tank in km
                range_per_tank_km = (car_specs.tank_capacity_liters / car_specs.fuel_consumption) * 100.0
                if range_per_tank_km > 0:
                    costs.refueling_stops = ceil(remaining_distance_km / range_per_tank_km)
                else: # Avoid division by zero if tank gives no range
                    costs.refueling_stops = float('inf') if remaining_distance_km > 0 else 0 # Effectively, can't complete
            else:
                costs.refueling_stops = 0
        else: # Cannot calculate refueling stops if tank capacity or consumption is zero/invalid
            costs.refueling_stops = 0 if distance_km == 0 else float('inf')


    async def _calculate_motorcycle_costs(self, costs: TransportCosts, distance_km: float, motorcycle_specs: MotorcycleSpecifications):
        """Helper to calculate motorcycle-specific costs."""
        logger.debug(f"Calculating motorcycle costs for distance: {distance_km:.2f}km, specs: {motorcycle_specs!r}")
        # Fuel consumption in liters for the trip
        fuel_liters = 0
        if motorcycle_specs.fuel_economy > 0 : # km/L
            fuel_liters = distance_km / motorcycle_specs.fuel_economy
        else: # Avoid division by zero
             costs.fuel_cost = float('inf') if distance_km > 0 else 0
             costs.refueling_stops = float('inf') if distance_km > 0 else 0

        agent_response = await self.fuel_agent.process(fuel_type=motorcycle_specs.fuel_type, region="default")
        fuel_price_per_liter = self.FUEL_PRICES.get(motorcycle_specs.fuel_type.lower(), 1.1) # Default, ensure lowercase match
        if agent_response.get("success"):
            fuel_price_per_liter = agent_response.get("data", {}).get("price_per_liter", fuel_price_per_liter)

        costs.fuel_consumption = fuel_liters
        if costs.fuel_cost != float('inf') : # if not already inf
            costs.fuel_cost = fuel_liters * fuel_price_per_liter
        costs.maintenance_cost = distance_km * 0.03  # Standard $0.03 per km

        if motorcycle_specs.tank_capacity_liters > 0 and motorcycle_specs.fuel_economy > 0:
            # Range on initial fuel in km
            range_on_initial_fuel_km = motorcycle_specs.initial_fuel_liters * motorcycle_specs.fuel_economy
            remaining_distance_km = distance_km - range_on_initial_fuel_km
            if remaining_distance_km > 0:
                # Range per full tank in km
                range_per_tank_km = motorcycle_specs.tank_capacity_liters * motorcycle_specs.fuel_economy
                if range_per_tank_km > 0:
                     costs.refueling_stops = ceil(remaining_distance_km / range_per_tank_km)
                else: # Avoid division by zero
                     costs.refueling_stops = float('inf') if remaining_distance_km > 0 else 0
            else:
                costs.refueling_stops = 0
        elif costs.refueling_stops != float('inf'): # if not already inf and cannot calculate
            costs.refueling_stops = 0 if distance_km == 0 else float('inf')


    def _calculate_calories(self, distance_meters: float, transport_type: TransportationType) -> float:
        """Calculate approximate calories burned during travel based on MET values."""
        # MET values (Metabolic Equivalent of Task)
        # Source: Compendium of Physical Activities (Ainsworth et al., 2011)
        # These are approximations. Actual calories depend on weight, intensity, etc.
        # Formula: Calories/min = (MET * body_weight_kg * 3.5) / 200
        # For simplicity, we'll use average calories per km without requiring user weight.

        logger.debug(f"Calculating calories for {transport_type}, distance={distance_meters/1000.0:.1f}km")

        # Average calories burned per kilometer (approximate)
        # These are very rough estimates.
        calories_per_km = {
            TransportationType.CAR: 0.5,         # Minimal, mostly sitting
            TransportationType.MOTORCYCLE: 1.0,  # Requires more engagement than car
            TransportationType.BUS: 0.8,         # Similar to car, plus walking to/from stop
            TransportationType.TRAIN: 0.8,       # Similar to bus
            TransportationType.WALKING: 60.0,    # Average for moderate pace walking
            TransportationType.BICYCLE: 30.0,    # Moderate cycling effort
        }.get(transport_type, 0.5) # Default to car rate

        kilometers = distance_meters / 1000.0
        total_calories = round(calories_per_km * kilometers, 2)

        logger.debug(f"Calculated approx. {total_calories} calories for {kilometers:.1f}km via {transport_type}.")
        return total_calories
