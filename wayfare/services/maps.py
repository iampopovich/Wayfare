from typing import List, Dict, Any, Optional
import asyncio
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

from services.base import BaseService
from models.base import GeoLocation, PlaceDetails, SearchResult
from repositories.maps.google_maps import GoogleMapsRepository
from repositories.maps.osm import OSMRepository
from repositories.maps.mapsme import MapsMeRepository


class MapsService(BaseService):
    """Service for coordinating between different map providers."""

    def __init__(
        self, google_maps_key: str, mapsme_key: str, model_name: str = "gpt-3.5-turbo"
    ):
        repositories = [
            GoogleMapsRepository(google_maps_key),
            OSMRepository(),
            MapsMeRepository(mapsme_key),
        ]
        super().__init__(repositories, model_name)
        self._setup_map_chains()

    def _setup_map_chains(self):
        """Setup additional LangChain chains specific to maps."""
        # Chain for route optimization
        self.route_optimizer_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["routes"],
                template="""
                Analyze the following routes from different providers:
                {routes}
                Compare factors like distance, duration, traffic, and reliability.
                Return the optimal route with explanation.
                """,
            ),
        )

        # Chain for place matching
        self.place_matcher_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["places"],
                template="""
                Compare the following place entries from different providers:
                {places}
                Identify matching places and consolidate their information.
                Return matched places as JSON array.
                """,
            ),
        )

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> SearchResult:
        """Search across all map providers."""
        # Perform parallel searches
        search_tasks = [
            repo.search(query, location, filters) for repo in self.repositories
        ]
        results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]

        # Aggregate and rank results
        return await self._aggregate_results(valid_results)

    async def get_details(self, item_id: str, source: str) -> PlaceDetails:
        """Get place details from a specific source."""
        # Find the appropriate repository
        repo = next(
            (r for r in self.repositories if source.lower() in str(type(r)).lower()),
            None,
        )
        if not repo:
            raise ValueError(f"Unknown source: {source}")

        return await repo.get_details(item_id)

    async def get_route(
        self,
        origin: GeoLocation,
        destination: GeoLocation,
        waypoints: Optional[List[GeoLocation]] = None,
        mode: str = "driving",
    ) -> Dict[str, Any]:
        """Get optimal route using multiple providers."""
        # Get routes from all providers
        route_tasks = [
            repo.get_route(origin, destination, waypoints, mode)
            for repo in self.repositories
        ]
        routes = await asyncio.gather(*route_tasks, return_exceptions=True)

        # Filter out any failed routes
        valid_routes = [r for r in routes if not isinstance(r, Exception)]

        if not valid_routes:
            raise ValueError("No valid routes found from any provider")

        # Use LangChain to analyze and select the optimal route
        routes_str = "\n".join([str(route) for route in valid_routes])
        optimal_route = await self.route_optimizer_chain.arun(routes_str)

        return optimal_route

    async def geocode(
        self, address: str, prefer_source: Optional[str] = None
    ) -> GeoLocation:
        """Geocode address using multiple providers."""
        if prefer_source:
            # Use preferred source if specified
            repo = next(
                (
                    r
                    for r in self.repositories
                    if prefer_source.lower() in str(type(r)).lower()
                ),
                None,
            )
            if repo:
                return await repo.geocode(address)

        # Otherwise, try all providers
        geocode_tasks = [repo.geocode(address) for repo in self.repositories]
        results = await asyncio.gather(*geocode_tasks, return_exceptions=True)

        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]

        if not valid_results:
            raise ValueError(f"Could not geocode address: {address}")

        # Resolve any conflicts in the results
        return await self._resolve_conflicts(valid_results)

    async def find_places_nearby(
        self,
        location: GeoLocation,
        radius: float = 1000,
        types: Optional[List[str]] = None,
    ) -> SearchResult:
        """Find places near a location using multiple providers."""
        search_tasks = [
            repo.search(
                query="", location=location, filters={"radius": radius, "types": types}
            )
            for repo in self.repositories
        ]
        results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]

        # Match and consolidate places from different providers
        places_str = "\n".join([str(result.dict()) for result in valid_results])
        matched_places = await self.place_matcher_chain.arun(places_str)

        return SearchResult(
            items=matched_places["items"],
            total_count=len(matched_places["items"]),
            metadata={"sources": [str(type(repo)) for repo in self.repositories]},
        )
