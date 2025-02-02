from typing import List, Optional, Dict, Any
import aiohttp
from langchain.tools import Tool
from langchain.agents import AgentType, initialize_agent

from repositories.base import BaseMapsRepository
from models.base import GeoLocation, PlaceDetails, SearchResult


class MapsMeRepository(BaseMapsRepository):
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo"):
        super().__init__(api_key, model_name)
        self.base_url = "https://api.maps.me/api/v1"
        
        # Create custom LangChain tools for Maps.me
        mapsme_tools = [
            Tool(
                name="search_mapsme",
                func=self._search_mapsme,
                description="Search for places in Maps.me"
            ),
            Tool(
                name="get_mapsme_details",
                func=self._get_place_details,
                description="Get detailed information about a place from Maps.me"
            )
        ]
        
        self.agent = initialize_agent(
            tools=mapsme_tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True
        )

    async def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Dict:
        """Make authenticated request to Maps.me API."""
        url = f"{self.base_url}/{endpoint}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                response.raise_for_status()
                return await response.json()

    async def _search_mapsme(self, query: str, location: Optional[GeoLocation] = None) -> Dict:
        """Internal method to search Maps.me."""
        params = {"query": query}
        if location:
            params.update({
                "lat": location.latitude,
                "lon": location.longitude
            })
        return await self._make_request("search", params)

    async def _get_place_details(self, place_id: str) -> Dict:
        """Internal method to get place details from Maps.me."""
        return await self._make_request(f"places/{place_id}")

    async def geocode(self, address: str) -> GeoLocation:
        """Convert address to coordinates using Maps.me API."""
        result = await self._make_request("geocode", {"address": address})
        return GeoLocation(
            latitude=result["lat"],
            longitude=result["lon"],
            address=address
        )

    async def reverse_geocode(self, location: GeoLocation) -> str:
        """Convert coordinates to address using Maps.me API."""
        result = await self._make_request("reverse", {
            "lat": location.latitude,
            "lon": location.longitude
        })
        return result["address"]

    async def get_route(
        self,
        origin: GeoLocation,
        destination: GeoLocation,
        waypoints: Optional[List[GeoLocation]] = None,
        mode: str = "driving"
    ) -> Dict[str, Any]:
        """Get route between points using Maps.me API."""
        params = {
            "origin_lat": origin.latitude,
            "origin_lon": origin.longitude,
            "dest_lat": destination.latitude,
            "dest_lon": destination.longitude,
            "mode": mode
        }
        
        if waypoints:
            params["waypoints"] = [
                {"lat": w.latitude, "lon": w.longitude}
                for w in waypoints
            ]
        
        result = await self._make_request("route", params)
        
        return {
            "distance": result["distance"],
            "duration": result["duration"],
            "route": result["route"],
            "steps": result["steps"]
        }

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for places using Maps.me API."""
        # Use LangChain agent for enhanced search
        agent_query = f"Find places in Maps.me matching '{query}'"
        if location:
            agent_query += f" near {location.latitude}, {location.longitude}"
        if filters:
            agent_query += f" with filters: {filters}"

        agent_result = await self.agent.arun(agent_query)
        
        # Make actual API request
        search_results = await self._search_mapsme(query, location)
        
        items = []
        for place in search_results["places"]:
            items.append(PlaceDetails(
                id=place["id"],
                name=place["name"],
                location=GeoLocation(
                    latitude=place["lat"],
                    longitude=place["lon"],
                    address=place.get("address")
                ),
                rating=place.get("rating"),
                photos=place.get("photos", []),
                metadata={
                    "category": place.get("category"),
                    "tags": place.get("tags", []),
                    "working_hours": place.get("working_hours")
                }
            ))

        return SearchResult(
            items=items,
            total_count=search_results["total"],
            page=search_results.get("page", 1),
            has_more=search_results.get("has_more", False)
        )

    async def get_details(self, item_id: str) -> PlaceDetails:
        """Get detailed information about a specific place."""
        details = await self._get_place_details(item_id)
        
        return PlaceDetails(
            id=details["id"],
            name=details["name"],
            location=GeoLocation(
                latitude=details["lat"],
                longitude=details["lon"],
                address=details.get("address")
            ),
            description=details.get("description"),
            rating=details.get("rating"),
            reviews_count=details.get("reviews_count"),
            photos=details.get("photos", []),
            amenities=details.get("amenities", []),
            metadata={
                "category": details.get("category"),
                "tags": details.get("tags", []),
                "working_hours": details.get("working_hours"),
                "contact": details.get("contact"),
                "accessibility": details.get("accessibility", {})
            }
        )
