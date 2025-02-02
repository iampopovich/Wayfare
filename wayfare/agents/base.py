from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from langchain_community.chat_models import ChatOpenAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from core.settings import settings

class BaseAgent(ABC):
    def __init__(self, model_name: Optional[str] = None):
        self.llm = ChatOpenAI(
            model_name=model_name or settings.OPENAI_MODEL_NAME,
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
        self.chain = None
        self._setup_chain()

    @abstractmethod
    def _setup_chain(self):
        """Setup the LangChain chain with appropriate prompt template."""
        pass

    @abstractmethod
    async def process(self, **kwargs) -> Dict[str, Any]:
        """Process the agent's specific task."""
        pass

    def _create_chain(self, template: str, input_variables: list) -> LLMChain:
        """Create a LangChain chain with the given template and input variables."""
        prompt = PromptTemplate(
            input_variables=input_variables,
            template=template
        )
        return LLMChain(llm=self.llm, prompt=prompt)

class AgentResponse:
    def __init__(
        self,
        success: bool,
        data: Dict[str, Any],
        error: Optional[str] = None
    ):
        self.success = success
        self.data = data
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error
        }

class AgentCoordinator:
    def __init__(self):
        self.agents = {}
        self._register_agents()

    def _register_agents(self):
        """Register all available agents."""
        from agents.route import RouteAgent
        from agents.accommodation import AccommodationAgent
        from agents.fuel import (
            FuelStationAgent, CarSpecificationAgent,
            FuelConsumptionAgent, FuelPriceAgent
        )
        from agents.cost import TotalCostAgent
        from agents.health import CaloriesAgent
        from agents.stops import StopsAgent
        from agents.food import FoodCostAgent

        self.agents = {
            "route": RouteAgent(),
            "accommodation": AccommodationAgent(),
            "fuel_station": FuelStationAgent(),
            "car_spec": CarSpecificationAgent(),
            "fuel_consumption": FuelConsumptionAgent(),
            "fuel_price": FuelPriceAgent(),
            "total_cost": TotalCostAgent(),
            "calories": CaloriesAgent(),
            "stops": StopsAgent(),
            "food_cost": FoodCostAgent()
        }

    async def coordinate_trip_planning(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Coordinate all agents for comprehensive trip planning."""
        results = {}
        
        # 1. Route Planning
        route_result = await self.agents["route"].process(**request)
        results["route"] = route_result

        # 2. Car and Fuel Planning (if applicable)
        if request.get("transportation_type") == "car":
            car_spec = await self.agents["car_spec"].process(
                car_model=request.get("car_model")
            )
            results["car_specification"] = car_spec

            fuel_consumption = await self.agents["fuel_consumption"].process(
                route=route_result["route"],
                car_spec=car_spec
            )
            results["fuel_consumption"] = fuel_consumption

            fuel_stations = await self.agents["fuel_station"].process(
                route=route_result["route"],
                fuel_consumption=fuel_consumption
            )
            results["fuel_stations"] = fuel_stations

            fuel_costs = await self.agents["fuel_price"].process(
                fuel_stations=fuel_stations,
                fuel_consumption=fuel_consumption
            )
            results["fuel_costs"] = fuel_costs

        # 3. Stops and Accommodation Planning
        stops = await self.agents["stops"].process(
            route=route_result["route"],
            transportation_type=request.get("transportation_type")
        )
        results["stops"] = stops

        if request.get("overnight_stay", {}).get("required", False):
            accommodation = await self.agents["accommodation"].process(
                stops=stops,
                preferences=request.get("overnight_stay")
            )
            results["accommodation"] = accommodation

        # 4. Food and Health Planning
        food_costs = await self.agents["food_cost"].process(
            duration=route_result["duration"],
            stops=stops,
            passengers=request.get("passengers", 1)
        )
        results["food_costs"] = food_costs

        calories = await self.agents["calories"].process(
            route=route_result["route"],
            transportation_type=request.get("transportation_type"),
            stops=stops
        )
        results["calories"] = calories

        # 5. Total Cost Calculation
        total_costs = await self.agents["total_cost"].process(
            route=route_result,
            accommodation=results.get("accommodation"),
            fuel_costs=results.get("fuel_costs"),
            food_costs=food_costs
        )
        results["total_costs"] = total_costs

        return results
