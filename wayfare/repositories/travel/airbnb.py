from typing import List, Optional, Dict, Any
import aiohttp
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from langchain.tools import Tool
from langchain.agents import AgentType, initialize_agent
from tenacity import retry, stop_after_attempt, wait_exponential

from repositories.base import BaseAccommodationRepository
from models.base import GeoLocation, PlaceDetails, SearchResult, Accommodation, PriceRange


class AirbnbRepository(BaseAccommodationRepository):
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo"):
        super().__init__(api_key, model_name)
        self.base_url = "https://api.airbnb.com/v2"
        self.ua = UserAgent()
        self.driver = None
        
        # Create custom LangChain tools for Airbnb
        airbnb_tools = [
            Tool(
                name="parse_airbnb_search",
                func=self._parse_search_results,
                description="Parse Airbnb search results"
            ),
            Tool(
                name="parse_airbnb_details",
                func=self._parse_listing_details,
                description="Parse Airbnb listing details"
            )
        ]
        
        self.agent = initialize_agent(
            tools=airbnb_tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True
        )

    async def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests."""
        return {
            "X-Airbnb-API-Key": self.api_key,
            "User-Agent": self.ua.random,
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def _init_selenium(self):
        """Initialize undetected-chromedriver for bypassing anti-bot measures."""
        if not self.driver:
            options = uc.ChromeOptions()
            options.add_argument('--headless')
            self.driver = uc.Chrome(options=options)

    def _close_selenium(self):
        """Close Selenium WebDriver."""
        if self.driver:
            self.driver.quit()
            self.driver = None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict:
        """Make authenticated request to Airbnb API with retry logic."""
        url = f"{self.base_url}/{endpoint}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=await self._get_headers(), params=params) as response:
                response.raise_for_status()
                return await response.json()

    async def _parse_search_results(self, content: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse search results using LangChain."""
        result = await self.parser_chain.arun(str(content))
        return result

    async def _parse_listing_details(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Parse listing details using LangChain."""
        result = await self.parser_chain.arun(str(content))
        return result

    async def _fetch_with_selenium(self, url: str) -> str:
        """Fetch page content using Selenium for JavaScript-heavy pages."""
        self._init_selenium()
        self.driver.get(url)
        WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        return self.driver.page_source

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for accommodations on Airbnb."""
        params = {
            "query": query,
            "search_type": "search_query"
        }
        if location:
            params.update({
                "lat": location.latitude,
                "lng": location.longitude
            })
        if filters:
            params.update(filters)

        # Use LangChain agent for enhanced search
        agent_query = f"Search for Airbnb listings matching '{query}'"
        if location:
            agent_query += f" near {location.latitude}, {location.longitude}"
        if filters:
            agent_query += f" with filters: {filters}"

        agent_result = await self.agent.arun(agent_query)
        
        # Make API request
        search_results = await self._make_request("search_results", params)
        parsed_results = await self._parse_search_results(search_results)
        
        items = []
        for listing in parsed_results:
            items.append(Accommodation(
                id=listing["id"],
                name=listing["name"],
                location=GeoLocation(
                    latitude=listing["lat"],
                    longitude=listing["lng"],
                    address=listing.get("address")
                ),
                price_range=PriceRange(
                    min_price=listing["price"]["amount"],
                    currency=listing["price"]["currency"]
                ),
                rating=listing.get("rating"),
                reviews_count=listing.get("reviews_count"),
                photos=listing.get("photos", []),
                amenities=listing.get("amenities", []),
                room_types=[listing.get("room_type")],
                booking_url=f"https://airbnb.com/rooms/{listing['id']}",
                metadata={
                    "host": listing.get("host", {}),
                    "instant_book": listing.get("instant_book", False),
                    "superhost": listing.get("superhost", False),
                    "house_rules": listing.get("house_rules", [])
                }
            ))

        return SearchResult(
            items=items,
            total_count=search_results["total_count"],
            page=search_results.get("page", 1),
            has_more=search_results.get("has_more", False)
        )

    async def get_details(self, item_id: str) -> Accommodation:
        """Get detailed information about a specific accommodation."""
        # Try API first
        try:
            details = await self._make_request(f"listings/{item_id}")
        except aiohttp.ClientError:
            # Fallback to web scraping if API fails
            url = f"https://airbnb.com/rooms/{item_id}"
            html_content = await self._fetch_with_selenium(url)
            details = await self.parser_chain.arun(html_content)
        
        parsed_details = await self._parse_listing_details(details)
        
        return Accommodation(
            id=parsed_details["id"],
            name=parsed_details["name"],
            location=GeoLocation(
                latitude=parsed_details["lat"],
                longitude=parsed_details["lng"],
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
            room_types=[parsed_details.get("room_type")],
            booking_url=f"https://airbnb.com/rooms/{item_id}",
            metadata={
                "host": parsed_details.get("host", {}),
                "instant_book": parsed_details.get("instant_book", False),
                "superhost": parsed_details.get("superhost", False),
                "house_rules": parsed_details.get("house_rules", []),
                "cancellation_policy": parsed_details.get("cancellation_policy"),
                "neighborhood": parsed_details.get("neighborhood", {})
            }
        )

    async def check_availability(
        self,
        item_id: str,
        check_in: str,
        check_out: str,
        guests: int = 1
    ) -> Dict[str, Any]:
        """Check listing availability for specific dates."""
        params = {
            "check_in": check_in,
            "check_out": check_out,
            "guests": guests
        }
        
        try:
            availability = await self._make_request(
                f"listings/{item_id}/availability",
                params
            )
        except aiohttp.ClientError:
            # Fallback to web scraping
            url = f"https://airbnb.com/rooms/{item_id}?check_in={check_in}&check_out={check_out}&guests={guests}"
            html_content = await self._fetch_with_selenium(url)
            availability = await self.parser_chain.arun(
                f"Extract availability and pricing information from: {html_content}"
            )
        
        return availability

    async def get_reviews(
        self,
        item_id: str,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get listing reviews."""
        params = {
            "page": page,
            "limit": limit,
            "_format": "for_mobile_client"
        }
        
        try:
            reviews = await self._make_request(
                f"listings/{item_id}/reviews",
                params
            )
        except aiohttp.ClientError:
            # Fallback to web scraping
            url = f"https://airbnb.com/rooms/{item_id}/reviews"
            html_content = await self._fetch_with_selenium(url)
            reviews = await self.parser_chain.arun(
                f"Extract review information from: {html_content}"
            )
        
        return reviews

    def __del__(self):
        """Cleanup Selenium WebDriver on object destruction."""
        self._close_selenium()
