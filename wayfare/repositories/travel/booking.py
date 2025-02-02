from typing import List, Optional, Dict, Any
import aiohttp
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from langchain.tools import Tool
from langchain.agents import AgentType, initialize_agent

from repositories.base import BaseAccommodationRepository
from models.base import GeoLocation, PlaceDetails, SearchResult, Accommodation


class BookingRepository(BaseAccommodationRepository):
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo"):
        super().__init__(api_key, model_name)
        self.base_url = "https://www.booking.com"
        self.ua = UserAgent()

        # Create custom LangChain tools for parsing Booking.com data
        booking_tools = [
            Tool(
                name="parse_booking_search",
                func=self._parse_search_results,
                description="Parse Booking.com search results",
            ),
            Tool(
                name="parse_booking_details",
                func=self._parse_hotel_details,
                description="Parse Booking.com hotel details",
            ),
        ]

        self.agent = initialize_agent(
            tools=booking_tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True,
        )

    async def _get_headers(self) -> Dict[str, str]:
        """Get headers for requests with rotating user agent."""
        return {
            "User-Agent": self.ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive",
        }

    async def _fetch_page(self, url: str) -> str:
        """Fetch page content with proper headers and error handling."""
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=await self._get_headers()) as response:
                response.raise_for_status()
                return await response.text()

    async def _parse_search_results(self, html_content: str) -> List[Dict[str, Any]]:
        """Parse search results HTML using LangChain."""
        soup = BeautifulSoup(html_content, "html.parser")
        # Use LangChain to extract structured data
        result = await self.parser_chain.arun(str(soup))
        return result

    async def _parse_hotel_details(self, html_content: str) -> Dict[str, Any]:
        """Parse hotel details HTML using LangChain."""
        soup = BeautifulSoup(html_content, "html.parser")
        # Use LangChain to extract structured data
        result = await self.parser_chain.arun(str(soup))
        return result

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> SearchResult:
        """Search for accommodations on Booking.com."""
        # Construct search URL
        search_url = f"{self.base_url}/search"
        params = {"ss": query}
        if location:
            params.update(
                {"latitude": location.latitude, "longitude": location.longitude}
            )
        if filters:
            params.update(filters)

        # Fetch and parse results
        html_content = await self._fetch_page(search_url)
        parsed_results = await self._parse_search_results(html_content)

        items = []
        for result in parsed_results:
            items.append(
                Accommodation(
                    id=result["hotel_id"],
                    name=result["name"],
                    location=GeoLocation(
                        latitude=result["latitude"],
                        longitude=result["longitude"],
                        address=result["address"],
                    ),
                    price_range={
                        "min_price": result["price"],
                        "currency": result["currency"],
                    },
                    rating=result.get("rating"),
                    reviews_count=result.get("reviews_count"),
                    photos=result.get("photos", []),
                    amenities=result.get("amenities", []),
                    room_types=result.get("room_types", []),
                    booking_url=result.get("url"),
                )
            )

        return SearchResult(
            items=items, total_count=len(items), has_more="pagination" in parsed_results
        )

    async def get_details(self, item_id: str) -> Accommodation:
        """Get detailed information about a specific accommodation."""
        url = f"{self.base_url}/hotel/{item_id}"
        html_content = await self._fetch_page(url)
        details = await self._parse_hotel_details(html_content)

        return Accommodation(
            id=item_id,
            name=details["name"],
            location=GeoLocation(
                latitude=details["latitude"],
                longitude=details["longitude"],
                address=details["address"],
            ),
            description=details.get("description"),
            price_range=details.get("price_range"),
            rating=details.get("rating"),
            reviews_count=details.get("reviews_count"),
            photos=details.get("photos", []),
            amenities=details.get("amenities", []),
            room_types=details.get("room_types", []),
            booking_url=url,
        )

    async def check_availability(
        self, item_id: str, check_in: str, check_out: str, guests: int = 1
    ) -> Dict[str, Any]:
        """Check room availability for specific dates."""
        url = f"{self.base_url}/hotel/{item_id}"
        params = {"checkin": check_in, "checkout": check_out, "group_adults": guests}

        html_content = await self._fetch_page(url)
        availability = await self.parser_chain.arun(
            f"Extract availability and pricing information from: {html_content}"
        )
        return availability

    async def get_reviews(
        self, item_id: str, page: int = 1, limit: int = 10
    ) -> Dict[str, Any]:
        """Get accommodation reviews."""
        url = f"{self.base_url}/hotel/{item_id}/reviews"
        params = {"page": page, "rows": limit}

        html_content = await self._fetch_page(url)
        reviews = await self.parser_chain.arun(
            f"Extract review information from: {html_content}"
        )
        return reviews
