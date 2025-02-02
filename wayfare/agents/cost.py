from typing import Dict, Any, List, Optional
from agents.base import BaseAgent, AgentResponse

class TotalCostAgent(BaseAgent):
    def _setup_chain(self):
        template = """
        Calculate total trip costs considering:
        - Transportation costs: {transportation_costs}
        - Accommodation costs: {accommodation_costs}
        - Fuel costs: {fuel_costs}
        - Food costs: {food_costs}
        - Additional expenses: {additional_expenses}
        """
        self.chain = self._create_chain(
            template=template,
            input_variables=[
                "transportation_costs", "accommodation_costs",
                "fuel_costs", "food_costs", "additional_expenses"
            ]
        )

    async def process(self, **kwargs) -> Dict[str, Any]:
        try:
            cost_data = await self._calculate_total_costs(**kwargs)
            return AgentResponse(
                success=True,
                data=cost_data,
                error=None
            ).to_dict()
        except Exception as e:
            return AgentResponse(
                success=False,
                data={},
                error=str(e)
            ).to_dict()

    async def _calculate_total_costs(self, **kwargs) -> Dict[str, Any]:
        """Calculate comprehensive trip costs."""
        return {
            "total_cost": 0,
            "cost_breakdown": {
                "transportation": 0,
                "accommodation": 0,
                "fuel": 0,
                "food": 0,
                "additional": 0
            },
            "cost_per_day": 0,
            "cost_per_person": 0,
            "currency": "USD",
            "savings_recommendations": [],
            "cost_optimization_tips": []
        }

    def _calculate_per_person_costs(
        self,
        total_costs: Dict[str, float],
        num_passengers: int
    ) -> Dict[str, float]:
        """Calculate costs per person."""
        return {
            category: amount / num_passengers
            for category, amount in total_costs.items()
        }

    def generate_cost_optimization_tips(
        self,
        costs: Dict[str, Any]
    ) -> List[str]:
        """Generate tips for optimizing trip costs."""
        tips = []
        
        # Analyze costs and generate specific recommendations
        if costs["fuel"] > costs["total_cost"] * 0.3:
            tips.append("Consider carpooling or using public transport for parts of the journey")
        
        if costs["accommodation"] > costs["total_cost"] * 0.4:
            tips.append("Look for alternative accommodation options or consider camping")
        
        return tips

    def analyze_cost_patterns(
        self,
        costs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze cost patterns and identify potential savings."""
        return {
            "highest_expense_category": "",
            "potential_savings": 0,
            "cost_trends": {},
            "budget_recommendations": []
        }
