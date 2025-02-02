from typing import List, Tuple
import polyline
from models.travel import TravelRequest, TravelResponse, TransportationType
from models.route import Route, RouteSegment
from models.location import Location
from models.stops import Stop
from models.costs import Cost
from models.health import Health
from models.vehicle import TransportCosts, CarSpecifications
from repositories.maps.google_maps import GoogleMapsRepository
import logging
import aiohttp
import asyncio
from math import ceil

logger = logging.getLogger(__name__)

class TravelService:
    # Google Maps supported travel modes
    TRANSPORT_MODE_MAPPING = {
        TransportationType.CAR: "driving",
        TransportationType.WALKING: "walking",
        TransportationType.BICYCLE: "bicycling",
        TransportationType.BUS: "transit",
        TransportationType.TRAIN: "transit"
    }

    # Average fuel prices by type (USD per liter)
    FUEL_PRICES = {
        "gasoline": 1.2,
        "diesel": 1.1,
        "electric": 0.15  # Price per kWh
    }

    def __init__(self, maps_repository: GoogleMapsRepository):
        self.maps_repository = maps_repository

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
        request: TravelRequest
    ) -> TransportCosts:
        """Calculate transport costs based on mode and distance."""
        logger.info(f"Calculating costs for {transport_type}, distance={distance_meters/1000:.1f}km, duration={duration_minutes:.0f}min")
        
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
            # Calculate total mass (vehicle + passengers + luggage)
            total_mass = (
                request.car_specifications.base_mass +
                (request.car_specifications.passenger_mass * request.passengers)
            )
            
            # Adjust fuel consumption based on mass (approximate 1% increase per 100kg over base mass)
            mass_difference = total_mass - request.car_specifications.base_mass
            mass_factor = 1 + (mass_difference / 100) * 0.01  # 1% per 100kg
            adjusted_consumption = request.car_specifications.fuel_consumption * mass_factor
            
            # Calculate total fuel consumption
            total_consumption = (distance_km / 100) * adjusted_consumption
            fuel_price = self.FUEL_PRICES.get(request.car_specifications.fuel_type, 1.2)
            
            costs.fuel_consumption = round(total_consumption, 2)
            costs.fuel_cost = round(total_consumption * fuel_price, 2)
            
            # Calculate refueling stops if tank capacity is provided
            if request.car_specifications.tank_capacity:
                range_per_tank = (request.car_specifications.tank_capacity / adjusted_consumption) * 100
                costs.refueling_stops = max(0, int(distance_km / range_per_tank))
            
            costs.total_cost = costs.fuel_cost
            
        elif transport_type in [TransportationType.BUS, TransportationType.TRAIN, TransportationType.PLANE]:
            # Set base ticket prices per km for different transport types
            ticket_rates = {
                TransportationType.BUS: 0.1,    # $0.1 per km
                TransportationType.TRAIN: 0.15,  # $0.15 per km
                TransportationType.PLANE: 0.5    # $0.5 per km
            }
            
            base_rate = ticket_rates[transport_type]
            costs.ticket_cost = round(distance_km * base_rate * request.passengers, 2)
            costs.total_cost = costs.ticket_cost
            
        # For walking, only include food, water, and accommodation costs
        
        # Add food, water and accommodation costs to total
        if costs.food_cost:
            costs.total_cost += costs.food_cost
        if costs.water_cost:
            costs.total_cost += costs.water_cost
        if costs.accommodation_cost:
            costs.total_cost += costs.accommodation_cost
            
        logger.info(f"Calculated costs: {costs}")
        return costs

    async def _find_gas_stations_along_route(
        self,
        route_points: List[Tuple[float, float]],
        search_radius_meters: int = 5000
    ) -> List[dict]:
        """Find gas stations near route points using OpenStreetMap Overpass API."""
        logger.info(f"Finding gas stations along {len(route_points)} route points")
        gas_stations = []
        
        async with aiohttp.ClientSession() as session:
            for i, (lat, lon) in enumerate(route_points):
                logger.info(f"Searching for gas stations near point {i+1}/{len(route_points)}")
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
                    async with session.post('https://overpass-api.de/api/interpreter', data=query) as response:
                        if response.status == 200:
                            data = await response.json()
                            for element in data.get('elements', []):
                                # Get coordinates based on element type
                                if element['type'] == 'node':
                                    station_lat, station_lon = element['lat'], element['lon']
                                else:  # way or relation
                                    station_lat = element['center']['lat']
                                    station_lon = element['center']['lon']
                                
                                gas_stations.append({
                                    'location': {'latitude': station_lat, 'longitude': station_lon},
                                    'name': element.get('tags', {}).get('name', 'Gas Station'),
                                    'brand': element.get('tags', {}).get('brand', 'Unknown'),
                                    'amenities': ['fuel', 'rest_stop']
                                })
                            logger.info(f"Found {len(data.get('elements', []))} stations near point {i+1}")
                except Exception as e:
                    logger.warning(f"Failed to find gas stations near point {i+1}: {str(e)}")
                
                # Rate limiting to be nice to the API
                await asyncio.sleep(1)
        
        logger.info(f"Found total of {len(gas_stations)} gas stations")
        return gas_stations

    async def _calculate_optimal_stops(
        self,
        route_segments: List[RouteSegment],
        car_specs: CarSpecifications,
        total_distance_km: float,
        gas_stations: List[dict],
        request: TravelRequest
    ) -> List[dict]:
        """Calculate optimal stops based on fuel range, rest requirements, and current fuel level."""
        logger.info("Calculating optimal stops")
        stops = []
        
        # Calculate vehicle range with current load
        total_mass = car_specs.base_mass + (car_specs.passenger_mass * request.passengers)
        mass_factor = 1 + ((total_mass - car_specs.base_mass) / 100) * 0.01
        adjusted_consumption = car_specs.fuel_consumption * mass_factor
        
        # Calculate range with current fuel level
        current_range_km = (car_specs.initial_fuel / adjusted_consumption) * 100
        full_tank_range_km = (car_specs.tank_capacity / adjusted_consumption) * 100
        
        # Maximum driving time before rest (4 hours)
        MAX_DRIVING_TIME_MINUTES = 240
        FUEL_RESERVE_PERCENTAGE = 15  # Don't let tank go below 15%
        
        # Calculate when we need the first refuel
        first_refuel_distance = current_range_km * (1 - FUEL_RESERVE_PERCENTAGE/100)
        
        # Calculate required stops
        remaining_distance = total_distance_km - first_refuel_distance
        if remaining_distance > 0:
            additional_refuel_stops = ceil(remaining_distance / (full_tank_range_km * (1 - FUEL_RESERVE_PERCENTAGE/100)))
        else:
            additional_refuel_stops = 0
        
        num_refuel_stops = additional_refuel_stops + (1 if first_refuel_distance < total_distance_km else 0)
        
        # Calculate rest stops needed
        total_duration_minutes = sum(segment.duration for segment in route_segments)
        num_rest_stops = ceil(total_duration_minutes / MAX_DRIVING_TIME_MINUTES)
        
        # Take the maximum of refuel and rest stops needed
        num_total_stops = max(num_refuel_stops, num_rest_stops)
        
        if num_total_stops > 0:
            current_distance = 0
            current_fuel = car_specs.initial_fuel
            time_since_rest = 0
            last_rest_distance = 0
            
            for segment in route_segments:
                segment_distance = segment.distance / 1000  # Convert to km
                segment_time = segment.duration
                
                # Calculate fuel consumption for this segment
                segment_consumption = (segment_distance / 100) * adjusted_consumption
                
                # Check points along the segment
                check_points = [(d, segment_distance * (d/10)) for d in range(1, 11)]
                
                for progress, distance_in_segment in check_points:
                    point_distance = current_distance + distance_in_segment
                    point_time = time_since_rest + (segment_time * (progress/10))
                    current_fuel -= segment_consumption * (progress/10)
                    
                    needs_fuel = current_fuel / car_specs.tank_capacity < (FUEL_RESERVE_PERCENTAGE/100)
                    needs_rest = point_time >= MAX_DRIVING_TIME_MINUTES
                    
                    if needs_fuel or needs_rest:
                        # Find the closest gas station to this point
                        point_lat = segment.start_location.latitude + (segment.end_location.latitude - segment.start_location.latitude) * (progress/10)
                        point_lon = segment.start_location.longitude + (segment.end_location.longitude - segment.start_location.longitude) * (progress/10)
                        
                        # Find nearest station
                        nearest_station = min(
                            gas_stations,
                            key=lambda s: (
                                (s['location']['latitude'] - point_lat) ** 2 +
                                (s['location']['longitude'] - point_lon) ** 2
                            )
                        )
                        
                        # Calculate cumulative time to this point
                        cumulative_time = 0
                        for s in route_segments[:route_segments.index(segment)]:
                            cumulative_time += s.duration
                        cumulative_time += segment.duration * (progress/10)
                        
                        stop_type = []
                        if needs_fuel:
                            stop_type.append('refuel')
                            current_fuel = car_specs.tank_capacity  # Refuel to full
                        if needs_rest:
                            stop_type.append('rest')
                            time_since_rest = 0
                            last_rest_distance = point_distance
                        
                        stops.append({
                            'location': nearest_station['location'],
                            'name': nearest_station.get('name', f'Stop {len(stops) + 1}'),
                            'brand': nearest_station.get('brand', ''),
                            'estimated_arrival_time': int(cumulative_time),  # Convert to integer minutes
                            'distance_from_start': round(point_distance, 1),  # Round to 1 decimal
                            'facilities': nearest_station.get('amenities', ['fuel', 'rest_stop']),
                            'type': ' and '.join(stop_type),  # Use space instead of underscore
                            'duration': 30 if needs_rest else 15,  # 30 min for rest stops, 15 min for fuel stops
                            'fuel_level_before': round(current_fuel, 1),
                            'fuel_needed': round(car_specs.tank_capacity - current_fuel, 1) if needs_fuel else 0,
                            'rest_time_needed': 30 if needs_rest else 0
                        })
                
                current_distance += segment_distance
                time_since_rest += segment_time
        
        logger.info(f"Calculated {len(stops)} stops")
        return stops

    async def plan_travel(self, request: TravelRequest) -> TravelResponse:
        """Plan a travel route with all necessary details using Google Maps."""
        try:
            logger.info(f"Planning travel from {request.origin} to {request.destination}")
            logger.info(f"Transportation type: {request.transportation_type}")
            if request.car_specifications:
                logger.info(f"Car specs: {request.car_specifications}")
            
            # First, geocode the origin and destination
            logger.info(f"Geocoding locations: {request.origin} -> {request.destination}")
            
            origin_location = await self.maps_repository.geocode(request.origin)
            destination_location = await self.maps_repository.geocode(request.destination)
            
            logger.info(f"Geocoded locations: {origin_location} -> {destination_location}")

            # Convert transport type to Google Maps mode
            mode = self._get_google_maps_mode(request.transportation_type)
            logger.info(f"Using Google Maps travel mode: {mode}")

            # Get route from Google Maps
            logger.info("Requesting route from Google Maps")
            route = await self.maps_repository.get_directions(
                origin=origin_location,
                destination=destination_location,
                mode=mode
            )
            logger.info(f"Received route with {len(route.segments)} segments")

            # Extract route points for gas station search
            route_points = []
            total_distance_km = 0
            
            for segment in route.segments:
                route_points.append((
                    segment.start_location.latitude,
                    segment.start_location.longitude
                ))
                total_distance_km += segment.distance / 1000  # Convert meters to km
            
            # Add final destination
            if route.segments:
                route_points.append((
                    route.segments[-1].end_location.latitude,
                    route.segments[-1].end_location.longitude
                ))
            
            logger.info(f"Total route distance: {total_distance_km:.1f}km")
            logger.info(f"Extracted {len(route_points)} route points")
            
            # Find gas stations along route
            logger.info("Searching for gas stations along route")
            gas_stations = await self._find_gas_stations_along_route(route_points)
            logger.info(f"Found {len(gas_stations)} gas stations along route")
            
            # Temporarily disable stop calculations
            stops = []
            
            # Calculate transport costs
            logger.info("Calculating transport costs")
            costs = await self._calculate_transport_costs(
                sum(segment.distance for segment in route.segments),
                sum(segment.duration for segment in route.segments),
                request.transportation_type,
                request
            )
            logger.info(f"Calculated costs: {costs}")
            
            # Calculate health metrics
            logger.info("Calculating health impact")
            health = Health(
                total_calories=self._calculate_calories(
                    sum(segment.distance for segment in route.segments),
                    request.transportation_type
                ),
                activity_breakdown={
                    request.transportation_type.value: sum(segment.distance for segment in route.segments) * 0.1
                }
            )
            logger.info(f"Calculated health impact: {health}")
            
            response = TravelResponse(
                route=route,
                stops=stops,
                costs=costs,
                health=health
            )
            logger.info("Travel plan completed successfully")
            return response
            
        except Exception as e:
            logger.error(f"Error in plan_travel: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to plan travel: {str(e)}")

    def _calculate_calories(self, distance_meters: float, transport_type: TransportationType) -> float:
        """Calculate calories burned during travel."""
        logger.info(f"Calculating calories for {transport_type}, distance={distance_meters/1000:.1f}km")
        
        # Simple calorie calculation
        base_rate = {
            TransportationType.CAR: 0.1,     # Very low for driving
            TransportationType.BUS: 0.2,     # Slightly more for public transport
            TransportationType.TRAIN: 0.2,   # Similar to bus
            TransportationType.WALKING: 60,  # 60 calories per km
            TransportationType.BICYCLE: 40,  # 40 calories per km
        }.get(transport_type, 0.1)  # Default to car rate

        kilometers = distance_meters / 1000
        calories = round(base_rate * kilometers, 2)
        logger.info(f"Calculated calories: {calories}")
        return calories
