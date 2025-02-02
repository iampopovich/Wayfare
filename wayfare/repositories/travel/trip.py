from typing import List, Optional, Dict, Any
import aiohttp
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from langchain.tools import Tool
from langchain.agents import AgentType, initialize_agent
from tenacity import retry, stop_after_attempt, wait_exponential

from wayfare.repositories.base import BaseAccommodationRepository
from wayfare.models.base import GeoLocation, PlaceDetails, SearchResult, Accommodation, PriceRange


class TripRepository(BaseAccommodationRepository):
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo"):
        super().__init__(api_key, model_name)
        self.base_url = "https://api.trip.com/v1"
        self.ua = UserAgent()
        
        # Create custom LangChain tools for Trip.com
        trip_tools = [
            Tool(
                name="parse_trip_search",
                func=self._parse_search_results,
                description="Parse Trip.com search results"
            ),
            Tool(
                name="parse_trip_details",
                func=self._parse_hotel_details,
                description="Parse Trip.com hotel details"
            )
        ]
        
        self.agent = initialize_agent(
            tools=trip_tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True
        )

    async def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": self.ua.random,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict:
        """Make authenticated request to Trip.com API with retry logic."""
        url = f"{self.base_url}/{endpoint}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=await self._get_headers(), params=params) as response:
                response.raise_for_status()
                return await response.json()

    async def _parse_search_results(self, content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse search results using LangChain."""
        result = await self.parser_chain.arun(str(content))
        return result

    async def _parse_hotel_details(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Parse hotel details using LangChain."""
        result = await self.parser_chain.arun(str(content))
        return result

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for accommodations on Trip.com."""
        params = {"keyword": query}
        if location:
            params.update({
                "latitude": location.latitude,
                "longitude": location.longitude
            })
        if filters:
            params.update(filters)

        # Use LangChain agent for enhanced search
        agent_query = f"Search for accommodations on Trip.com matching '{query}'"
        if location:
            agent_query += f" near {location.latitude}, {location.longitude}"
        if filters:
            agent_query += f" with filters: {filters}"

        agent_result = await self.agent.arun(agent_query)
        
        # Make API request
        search_results = await self._make_request("hotels/search", params)
        parsed_results = await self._parse_search_results(search_results)
        
        items = []
        for hotel in parsed_results:
            items.append(Accommodation(
                id=hotel["id"],
                name=hotel["name"],
                location=GeoLocation(
                    latitude=hotel["latitude"],
                    longitude=hotel["longitude"],
                    address=hotel.get("address")
                ),
                price_range=PriceRange(
                    min_price=hotel["price"]["amount"],
                    currency=hotel["price"]["currency"]
                ),
                rating=hotel.get("rating"),
                reviews_count=hotel.get("reviews_count"),
                photos=hotel.get("photos", []),
                amenities=hotel.get("amenities", []),
                room_types=hotel.get("room_types", []),
                booking_url=hotel.get("booking_url"),
                metadata={
                    "chain": hotel.get("chain"),
                    "stars": hotel.get("stars"),
                    "policies": hotel.get("policies", {})
                }
            ))

        return SearchResult(
            items=items,
            total_count=search_results["total"],
            page=search_results.get("page", 1),
            has_more=search_results.get("has_more", False)
        )

    async def get_details(self, item_id: str) -> Accommodation:
        """Get detailed information about a specific accommodation."""
        details = await self._make_request(f"hotels/{item_id}")
        parsed_details = await self._parse_hotel_details(details)
        
        return Accommodation(
            id=parsed_details["id"],
            name=parsed_details["name"],
            location=GeoLocation(
                latitude=parsed_details["latitude"],
                longitude=parsed_details["longitude"],
                address=parsed_details.get("address")
            ),
            description=parsed_details.get("description"),
            price_range=PriceRange(
                min_price=parsed_details["price"]["amount"],
                currency=parsed_details["price"]["currency"]
            ),
            rating=parsed_details.get("rating"),
            reviews_count=parsed_details.get("reviews_count"),
            photos=parsed_details.get("photos", []),
            amenities=parsed_details.get("amenities", []),
            room_types=parsed_details.get("room_types", []),
            booking_url=parsed_details.get("booking_url"),
            metadata={
                "chain": parsed_details.get("chain"),
                "stars": parsed_details.get("stars"),
                "policies": parsed_details.get("policies", {}),
                "facilities": parsed_details.get("facilities", []),
                "nearby": parsed_details.get("nearby", [])
            }
        )

    async def check_availability(
        self,
        item_id: str,
        check_in: str,
        check_out: str,
        guests: int = 1
    ) -> Dict[str, Any]:
        """Check room availability for specific dates."""
        params = {
            "check_in": check_in,
            "check_out": check_out,
            "guests": guests
        }
        
        availability = await self._make_request(
            f"hotels/{item_id}/availability",
            params
        )
        
        return await self.parser_chain.arun(
            f"Extract availability and pricing information from: {availability}"
        )

    async def get_reviews(
        self,
        item_id: str,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get accommodation reviews."""
        params = {
            "page": page,
            "limit": limit
        }
        
        reviews = await self._make_request(
            f"hotels/{item_id}/reviews",
            params
        )
        
        return await self.parser_chain.arun(
            f"Extract review information from: {reviews}"
        )
