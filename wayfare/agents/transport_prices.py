from typing import Dict, Any
from datetime import datetime
from agents.base import BaseAgent, AgentResponse
from services.search import SearchService

class TransportPriceAgent(BaseAgent):
    def __init__(self, search_service: SearchService):
        super().__init__()
        self.search_service = search_service

    def _setup_chain(self):
        template = """
        Find transportation prices considering:
        - Origin: {origin}
        - Destination: {destination}
        - Transport type: {transport_type}
        - Date: {date}
        - Additional requirements: {requirements}
        """
        self.chain = self._create_chain(
            template=template,
            input_variables=[
                "origin", "destination", "transport_type",
                "date", "requirements"
            ]
        )

    async def process(self, **kwargs) -> Dict[str, Any]:
        try:
            prices = await self._find_transport_prices(**kwargs)
            return AgentResponse(
                success=True,
                data=prices,
                error=None
            ).to_dict()
        except Exception as e:
            return AgentResponse(
                success=False,
                data={},
                error=str(e)
            ).to_dict()

    async def _find_transport_prices(self, **kwargs) -> Dict[str, Any]:
        """Find transportation prices using search service."""
        origin = kwargs.get("origin", "")
        destination = kwargs.get("destination", "")
        transport_type = kwargs.get("transport_type", "bus")
        date = kwargs.get("date", datetime.now().strftime("%Y-%m-%d"))
        
        # Format search queries for different aspects
        queries = [
            f"{transport_type} ticket from {origin} to {destination}",
            f"{transport_type} fare {origin} {destination}",
            f"{origin} to {destination} {transport_type} schedule price",
            f"how much does {transport_type} ticket cost from {origin} to {destination}"
        ]
        
        all_results = []
        for query in queries:
            results = await self.search_service.search_prices(
                query=query,
                currency="USD"  # Can be made configurable
            )
            all_results.extend(results)
        
        # Process and analyze results
        price_data = self._analyze_price_results(all_results)
        
        # Find schedule information
        schedule_query = f"{transport_type} schedule {origin} to {destination} {date}"
        schedule_results = await self.search_service.search(
            query=schedule_query,
            engines=["duckduckgo"],
            filters={"content_type": ["schedule", "timetable"]}
        )
        
        return {
            "prices": price_data,
            "schedules": self._extract_schedule_info(schedule_results),
            "booking_links": self._extract_booking_links(all_results),
            "route_info": {
                "origin": origin,
                "destination": destination,
                "transport_type": transport_type,
                "date": date
            }
        }
    
    def _analyze_price_results(self, results: list) -> Dict[str, Any]:
        """Analyze price results to extract meaningful price information."""
        if not results:
            return {
                "average": None,
                "min": None,
                "max": None,
                "currency": "USD",
                "confidence": 0
            }
        
        prices = []
        for result in results:
            if isinstance(result.get("price"), (int, float)):
                prices.append(result["price"])
        
        if not prices:
            return {
                "average": None,
                "min": None,
                "max": None,
                "currency": "USD",
                "confidence": 0
            }
        
        return {
            "average": sum(prices) / len(prices),
            "min": min(prices),
            "max": max(prices),
            "currency": "USD",
            "confidence": min(1.0, len(prices) / 10)  # Higher confidence with more sources
        }
    
    def _extract_schedule_info(self, results: list) -> list:
        """Extract schedule information from search results."""
        schedules = []
        for result in results:
            # This is a simplified example - in reality, you'd want more sophisticated
            # schedule extraction logic
            schedule = {
                "source": result["url"],
                "details": result["snippet"],
                "confidence": 0.5  # Can be adjusted based on source reliability
            }
            schedules.append(schedule)
        return schedules
    
    def _extract_booking_links(self, results: list) -> list:
        """Extract relevant booking links from results."""
        booking_links = []
        for result in results:
            if any(keyword in result["url"].lower() for keyword in ["book", "ticket", "reservation"]):
                booking_links.append({
                    "url": result["url"],
                    "title": result["title"],
                    "source": result["source"]
                })
        return booking_links
