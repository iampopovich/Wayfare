from typing import Dict, Any, List
from datetime import datetime, timedelta
from agents.base import BaseAgent, AgentResponse


class StopsAgent(BaseAgent):
    def _setup_chain(self):
        template = """
        Plan optimal stops considering:
        - Route details: {route_details}
        - Transportation type: {transportation_type}
        - Driver/passenger conditions: {conditions}
        - Time constraints: {time_constraints}
        - Required stop types: {required_stops}
        """
        self.chain = self._create_chain(
            template=template,
            input_variables=[
                "route_details",
                "transportation_type",
                "conditions",
                "time_constraints",
                "required_stops",
            ],
        )

    async def process(self, **kwargs) -> Dict[str, Any]:
        try:
            stops_plan = await self._plan_stops(**kwargs)
            return AgentResponse(success=True, data=stops_plan, error=None).to_dict()
        except Exception as e:
            return AgentResponse(success=False, data={}, error=str(e)).to_dict()

    async def _plan_stops(self, **kwargs) -> Dict[str, Any]:
        """Plan comprehensive stops for the journey."""
        # Default rules for stops
        rules = {
            "car": {
                "max_driving_time": timedelta(hours=4),
                "min_rest_time": timedelta(minutes=30),
                "max_total_daily_driving": timedelta(hours=8),
            },
            "motorcycle": {
                "max_driving_time": timedelta(hours=3),
                "min_rest_time": timedelta(minutes=45),
                "max_total_daily_driving": timedelta(hours=6),
            },
            "bicycle": {
                "max_riding_time": timedelta(hours=2),
                "min_rest_time": timedelta(minutes=15),
                "max_total_daily_riding": timedelta(hours=6),
            },
            "walking": {
                "max_walking_time": timedelta(hours=2),
                "min_rest_time": timedelta(minutes=20),
                "max_total_daily_walking": timedelta(hours=6),
            },
        }

        # Extract route details
        route_details = kwargs.get("route_details", {})
        transport_type = kwargs.get("transportation_type", "car")
        conditions = kwargs.get("conditions", {})
        time_constraints = kwargs.get("time_constraints", {})
        required_stops = kwargs.get("required_stops", [])

        # Get vehicle specifications
        vehicle_specs = conditions.get("vehicle_specifications", {})
        
        # Calculate total distance and duration
        total_distance = route_details.get("total_distance", 0)  # in km
        total_duration = route_details.get("total_duration", 0)  # in minutes
        
        # Get the rules for this transport type
        transport_rules = rules.get(transport_type, rules["car"])
        
        # Calculate fuel-based stops if applicable
        planned_stops = []
        if "fuel" in required_stops and vehicle_specs:
            fuel_consumption = vehicle_specs.get("fuel_consumption", 0)  # L/100km
            tank_capacity = vehicle_specs.get("tank_capacity", 0)  # L
            initial_fuel = vehicle_specs.get("initial_fuel", 0)  # L
            
            if fuel_consumption > 0 and tank_capacity > 0:
                # Calculate range on current fuel
                if transport_type == "motorcycle":
                    # For motorcycles, fuel_consumption is already in the correct format (L/100km)
                    range_on_current_fuel = (initial_fuel / fuel_consumption) * 100  # km
                    range_on_full_tank = (tank_capacity / fuel_consumption) * 100  # km
                else:
                    # For cars, using L/100km directly
                    range_on_current_fuel = (initial_fuel / fuel_consumption) * 100  # km
                    range_on_full_tank = (tank_capacity / fuel_consumption) * 100  # km
                
                # Add fuel stops
                distance_covered = range_on_current_fuel
                while distance_covered < total_distance:
                    # Find the nearest gas station to this point
                    nearest_station = None
                    min_distance = float('inf')
                    for station in route_details.get("gas_stations", []):
                        station_distance = station.get("distance_from_start", float('inf'))
                        if distance_covered - 20 <= station_distance <= distance_covered:  # Allow 20km buffer
                            if station_distance < min_distance:
                                min_distance = station_distance
                                nearest_station = station
                    
                    if nearest_station:
                        planned_stops.append({
                            "type": "fuel",
                            "location": nearest_station["location"],
                            "distance_from_start": min_distance,
                            "duration": 15,  # 15 minutes for refueling
                            "facilities": ["fuel"]
                        })
                    
                    distance_covered += range_on_full_tank

        # Add rest stops based on max driving time
        if "rest" in required_stops:
            max_driving_time = transport_rules["max_driving_time"].total_seconds() / 60  # convert to minutes
            current_driving_time = 0
            
            for segment in route_details.get("segments", []):
                current_driving_time += segment.get("duration", 0)
                if current_driving_time >= max_driving_time:
                    # Find a suitable rest stop location
                    location = segment.get("end_location", {})
                    if location:
                        planned_stops.append({
                            "type": "rest",
                            "location": location,
                            "distance_from_start": segment.get("distance", 0),
                            "duration": transport_rules["min_rest_time"].total_seconds() / 60,  # convert to minutes
                            "facilities": ["rest"]
                        })
                    current_driving_time = 0

        # Sort stops by distance
        planned_stops.sort(key=lambda x: x["distance_from_start"])

        # Calculate total duration including stops
        total_stop_time = sum(stop["duration"] for stop in planned_stops)
        total_duration_with_stops = total_duration + total_stop_time

        return {
            "planned_stops": planned_stops,
            "stop_types": {
                "rest": [stop for stop in planned_stops if stop["type"] == "rest"],
                "fuel": [stop for stop in planned_stops if stop["type"] == "fuel"],
                "food": [],
                "overnight": [],
                "sightseeing": [],
                "emergency": [],
            },
            "timing": {
                "departure_time": "",
                "arrival_time": "",
                "total_duration": total_duration_with_stops,  # Include stops in total duration
                "total_stop_time": total_stop_time,
                "driving_time": total_duration,  # Original driving time without stops
            },
            "stop_facilities": {},
            "alternative_stops": {},
            "recommendations": [],
        }

    def _calculate_optimal_stop_times(
        self, route_duration: timedelta, transportation_type: str, start_time: datetime
    ) -> List[datetime]:
        """Calculate optimal times for stops based on route and transportation."""
        return []

    def _find_stop_facilities(
        self, location: Dict[str, float], required_facilities: List[str]
    ) -> List[Dict[str, Any]]:
        """Find facilities at potential stop locations."""
        return []

    def _calculate_stop_duration(
        self, stop_type: str, facilities: List[str], time_of_day: datetime
    ) -> timedelta:
        """Calculate recommended duration for each stop."""
        durations = {
            "rest": timedelta(minutes=30),
            "fuel": timedelta(minutes=15),
            "food": timedelta(minutes=45),
            "overnight": timedelta(hours=8),
            "sightseeing": timedelta(hours=1),
        }
        return durations.get(stop_type, timedelta(minutes=15))

    def optimize_stops_for_sightseeing(
        self, route: Dict[str, Any], points_of_interest: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Optimize stops to include interesting sightseeing locations."""
        return []

    def generate_stop_recommendations(
        self, stops: List[Dict[str, Any]], preferences: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations for each stop."""
        return []
