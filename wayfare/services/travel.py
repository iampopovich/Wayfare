from typing import List, Tuple
import polyline
from models.travel import TravelRequest, TravelResponse, TransportationType
from models.route import Route, RouteSegment
from models.location import Location
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
            if request.overnight_stay and request.overnight_stay.max_price_per_night:
                costs.accommodation_cost = request.overnight_stay.max_price_per_night
            else:
                costs.accommodation_cost = 100  # Default $100 per night

        # Calculate transport-specific costs
        distance_km = distance_meters / 1000

        if transport_type == TransportationType.CAR and request.car_specifications:
            # Calculate car-specific costs
            specs = request.car_specifications
            fuel_consumption = (distance_km / 100) * specs.fuel_consumption
            fuel_price = await self.fuel_agent.get_fuel_price(specs.fuel_type) or self.FUEL_PRICES.get(specs.fuel_type, 1.2)
            
            costs.fuel_consumption = fuel_consumption
            costs.fuel_cost = fuel_consumption * fuel_price
            costs.maintenance_cost = distance_km * 0.05  # $0.05 per km for maintenance
            
            # Calculate number of refueling stops needed
            if specs.tank_capacity > 0:
                range_on_current_fuel = (specs.initial_fuel / specs.fuel_consumption) * 100
                remaining_distance = distance_km - range_on_current_fuel
                if remaining_distance > 0:
                    costs.refueling_stops = ceil(remaining_distance / ((specs.tank_capacity / specs.fuel_consumption) * 100))
                else:
                    costs.refueling_stops = 0

        elif transport_type == TransportationType.MOTORCYCLE and request.motorcycle_specifications:
            # Calculate motorcycle-specific costs
            specs = request.motorcycle_specifications
            # Convert km/L to total liters needed
            fuel_consumption = distance_km / specs.fuel_economy
            fuel_price = await self.fuel_agent.get_fuel_price(specs.fuel_type) or self.FUEL_PRICES.get(specs.fuel_type, 1.1)
            
            costs.fuel_consumption = fuel_consumption
            costs.fuel_cost = fuel_consumption * fuel_price
            costs.maintenance_cost = distance_km * 0.03  # $0.03 per km for maintenance (lower than cars)
            
            # Calculate number of refueling stops needed
            if specs.tank_capacity > 0:
                range_on_current_fuel = specs.initial_fuel * specs.fuel_economy
                remaining_distance = distance_km - range_on_current_fuel
                if remaining_distance > 0:
                    costs.refueling_stops = ceil(remaining_distance / (specs.tank_capacity * specs.fuel_economy))
                else:
                    costs.refueling_stops = 0

        elif transport_type in [TransportationType.BUS, TransportationType.TRAIN]:
            # Get ticket prices from transport price agent
            ticket_price = await self.transport_price_agent.get_ticket_price(
                transport_type, request.origin, request.destination
            )
            costs.ticket_cost = ticket_price * request.passengers

        # Calculate total cost
        total_cost = 0
        for cost_field in [
            costs.fuel_cost,
            costs.ticket_cost,
            costs.food_cost,
            costs.water_cost,
            costs.accommodation_cost,
            costs.maintenance_cost,
        ]:
            if cost_field is not None:
                total_cost += cost_field

        costs.total_cost = total_cost
        return costs

    async def _find_gas_stations_along_route(
        self, route_points: List[Tuple[float, float]], search_radius_meters: int = 5000
    ) -> List[dict]:
        """Find gas stations near route points using OpenStreetMap Overpass API."""
        logger.info(f"Finding gas stations along {len(route_points)} route points")
        gas_stations = []

        async with aiohttp.ClientSession() as session:
            for i, (lat, lon) in enumerate(route_points):
                logger.info(
                    f"Searching for gas stations near point {i+1}/{len(route_points)}"
                )
                # Overpass query to find gas stations within radius
                query = f"""
                [out:json][timeout:25];
                (
                  node["amenity"="fuel"](around:{search_radius_meters},{lat},{lon});
                  way["amenity"="fuel"](around:{search_radius_meters},{lat},{lon});
                  relation["amenity"="fuel"](around:{search_radius_meters},{lat},{lon});
                );
                out center;
                """

                try:
                    async with session.post(
                        "https://overpass-api.de/api/interpreter", data=query
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            for element in data.get("elements", []):
                                # Get coordinates based on element type
                                if element["type"] == "node":
                                    station_lat, station_lon = (
                                        element["lat"],
                                        element["lon"],
                                    )
                                else:  # way or relation
                                    station_lat = element["center"]["lat"]
                                    station_lon = element["center"]["lon"]

                                gas_stations.append(
                                    {
                                        "location": {
                                            "latitude": station_lat,
                                            "longitude": station_lon,
                                        },
                                        "name": element.get("tags", {}).get(
                                            "name", "Gas Station"
                                        ),
                                        "brand": element.get("tags", {}).get(
                                            "brand", "Unknown"
                                        ),
                                        "amenities": ["fuel", "rest_stop"],
                                    }
                                )
                            logger.info(
                                f"Found {len(data.get('elements', []))} stations near point {i+1}"
                            )
                except Exception as e:
                    logger.warning(
                        f"Failed to find gas stations near point {i+1}: {str(e)}"
                    )

                # Rate limiting to be nice to the API
                await asyncio.sleep(1)

        logger.info(f"Found total of {len(gas_stations)} gas stations")
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
            logger.info(f"Received route with {len(route.segments)} segments")

            # Extract route points for gas station search
            route_points = []
            total_distance_km = 0

            for segment in route.segments:
                route_points.append(
                    (segment.start_location.latitude, segment.start_location.longitude)
                )
                total_distance_km += segment.distance / 1000  # Convert meters to km

            # Add final destination
            if route.segments:
                route_points.append(
                    (
                        route.segments[-1].end_location.latitude,
                        route.segments[-1].end_location.longitude,
                    )
                )

            logger.info(f"Total route distance: {total_distance_km:.1f}km")
            logger.info(f"Extracted {len(route_points)} route points")

            # Find gas stations along route
            logger.info("Searching for gas stations along route")
            gas_stations = await self._find_gas_stations_along_route(route_points)
            logger.info(f"Found {len(gas_stations)} gas stations along route")

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
                        "fuel_consumption": request.car_specifications.fuel_consumption,
                        "tank_capacity": request.car_specifications.tank_capacity,
                        "initial_fuel": request.car_specifications.initial_fuel,
                        "fuel_type": request.car_specifications.fuel_type,
                    }
                else:  # Motorcycle
                    # Convert km/L to L/100km for consistency
                    fuel_consumption = 100 / request.motorcycle_specifications.fuel_economy
                    vehicle_specs = {
                        "fuel_consumption": fuel_consumption,
                        "tank_capacity": request.motorcycle_specifications.tank_capacity,
                        "initial_fuel": request.motorcycle_specifications.initial_fuel,
                        "fuel_type": request.motorcycle_specifications.fuel_type,
                    }

                agent_response = await self.stops_agent.process(
                    route_details={
                        "total_distance": total_distance_km,
                        "total_duration": sum(
                            segment.duration for segment in route.segments
                        ),
                        "segments": [
                            {
                                "distance": segment.distance / 1000,
                                "duration": segment.duration,
                                "start_location": {
                                    "latitude": segment.start_location.latitude,
                                    "longitude": segment.start_location.longitude,
                                    "address": segment.start_location.address,
                                },
                                "end_location": {
                                    "latitude": segment.end_location.latitude,
                                    "longitude": segment.end_location.longitude,
                                    "address": segment.end_location.address,
                                },
                            }
                            for segment in route.segments
                        ],
                        "gas_stations": gas_stations,
                    },
                    transportation_type=request.transportation_type.value,
                    conditions={
                        "vehicle_specifications": vehicle_specs,
                        "passengers": request.passengers,
                    },
                    time_constraints={
                        "max_driving_time": 180 if request.transportation_type == TransportationType.MOTORCYCLE else 240,  # 3 hours for motorcycle, 4 for car
                        "min_rest_time": 45 if request.transportation_type == TransportationType.MOTORCYCLE else 30,  # 45 minutes for motorcycle, 30 for car
                    },
                    required_stops=["fuel", "rest"],
                )

                if agent_response["success"]:
                    logger.info("Successfully calculated stops with StopsAgent")
                    stops = agent_response["data"]["planned_stops"]
                    total_duration = agent_response["data"]["timing"]["total_duration"]

                    # Update route total duration to include stops
                    route.total_duration = total_duration

                    # Add stops to route segments
                    for stop in stops:
                        # Find the segment where this stop belongs
                        stop_distance = stop["distance_from_start"]
                        current_distance = 0

                        for segment in route.segments:
                            segment_distance = segment.distance / 1000  # Convert to km
                            if (
                                current_distance
                                <= stop_distance
                                < current_distance + segment_distance
                            ):
                                # This stop belongs to this segment
                                if not hasattr(segment, "stops"):
                                    segment.stops = []
                                segment.stops.append(stop)
                                break
                            current_distance += segment_distance
                else:
                    logger.error(
                        f"Failed to calculate stops: {agent_response['error']}"
                    )

            # Calculate transport costs
            logger.info("Calculating transport costs")
            costs = await self._calculate_transport_costs(
                sum(segment.distance for segment in route.segments),
                route.total_duration,  # Use updated duration that includes stops
                request.transportation_type,
                request,
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
            logger.info(f"Calculated health impact: {health}")

            # Calculate weather data
            logger.info("Calculating weather data")
            route_dict = {
                "segments": [
                    {
                        "start_location": {
                            "latitude": segment.start_location.latitude,
                            "longitude": segment.start_location.longitude,
                            "address": segment.start_location.address,
                        },
                        "end_location": {
                            "latitude": segment.end_location.latitude,
                            "longitude": segment.end_location.longitude,
                            "address": segment.end_location.address,
                        },
                    }
                    for segment in route.segments
                ]
            }
            weather_response = await self.weather_agent.process(route=route_dict)
            weather_data = (
                weather_response.get("data", {})
                if weather_response.get("success")
                else {}
            )
            logger.info(f"Calculated weather data: {weather_data}")

            response = TravelResponse(
                route=route,
                stops=stops,
                costs=costs,
                health=health,
                weather=weather_data,
            )
            logger.info("Travel plan completed successfully")
            return response

        except Exception as e:
            logger.error(f"Error in plan_travel: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to plan travel: {str(e)}")

    def _calculate_calories(
        self, distance_meters: float, transport_type: TransportationType
    ) -> float:
        """Calculate calories burned during travel."""
        logger.info(
            f"Calculating calories for {transport_type}, distance={distance_meters/1000:.1f}km"
        )

        # Simple calorie calculation
        base_rate = {
            TransportationType.CAR: 0.1,  # Very low for driving
            TransportationType.MOTORCYCLE: 0.2,  # Slightly more for motorcycles
            TransportationType.BUS: 0.2,  # Slightly more for public transport
            TransportationType.TRAIN: 0.2,  # Similar to bus
            TransportationType.WALKING: 60,  # 60 calories per km
            TransportationType.BICYCLE: 40,  # 40 calories per km
        }.get(
            transport_type, 0.1
        )  # Default to car rate

        kilometers = distance_meters / 1000
        calories = round(base_rate * kilometers, 2)
        logger.info(f"Calculated calories: {calories}")
        return calories
