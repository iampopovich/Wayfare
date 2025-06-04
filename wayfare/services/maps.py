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

    async def search_places( # Renamed to align with repository and API conventions
        self,
        query: str,
        location: Optional[GeoLocation] = None, # GeoLocation is used by OSM/MapsMe, GoogleMapsRepository expects models.location.Location for input
        radius: Optional[int] = None, # Added radius, as it's a common search param
        filters: Optional[Dict[str, Any]] = None,
    ) -> SearchResult:
        """Search for places across all map providers."""
        search_tasks = []
        for repo in self.repositories:
            if isinstance(repo, GoogleMapsRepository):
                # GoogleMapsRepository expects models.location.Location and has 'radius' as a direct param
                gmaps_location: Optional[Location] = None
                if location:
                    gmaps_location = Location(latitude=location.latitude, longitude=location.longitude, address=location.address)
                task = repo.search_places(query=query, location=gmaps_location, radius=radius, filters=filters)
            elif isinstance(repo, (OSMRepository, MapsMeRepository)): # Assuming these have a 'search' method
                # Need to ensure OSMRepository and MapsMeRepository handle GeoLocation and filters appropriately.
                # If their 'search' methods don't accept 'radius' directly in filters, this might need adjustment.
                current_filters = (filters or {}).copy()
                if radius and not current_filters.get("radius"): # Add radius to filters if not already there for these repos
                    current_filters["radius"] = radius
                task = repo.search(query=query, location=location, filters=current_filters)
            else:
                # Fallback or skip repo if type is unknown or doesn't match known search signatures
                # For now, let's assume other repos might have a compatible search method
                current_filters = (filters or {}).copy()
                if radius and not current_filters.get("radius"):
                     current_filters["radius"] = radius
                if hasattr(repo, "search"):
                    task = repo.search(query=query, location=location, filters=current_filters)
                elif hasattr(repo, "search_places"): # If they adopted the new name
                    task = repo.search_places(query=query, location=location, radius=radius, filters=filters)
                else:
                    continue # Skip repo if no suitable search method
            search_tasks.append(task)

        results = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception) and r is not None] # Added r is not None

        if not valid_results:
            # Consider raising an error or returning an empty SearchResult
            return SearchResult(items=[], total_count=0, has_more=False, metadata={"errors": [str(e) for e in results if isinstance(e, Exception)]})

        # Aggregate and rank results (assuming _aggregate_results exists and handles SearchResult objects)
        # This part might need a more sophisticated aggregation logic if results are very different.
        # For now, let's assume _aggregate_results can merge items from multiple SearchResult objects.
        # A simple aggregation could be to combine all items and let the LLM re-rank or deduplicate.
        # However, the LLM chain for place_matcher_chain seems more appropriate for this.

        # For now, let's return the first valid result or an empty result,
        # as _aggregate_results is not defined in the provided code.
        # A proper implementation would merge these.
        # This is a placeholder for actual aggregation logic.
        if valid_results:
             # This is a simplistic approach. Ideally, results should be merged.
            all_items = []
            total_items = 0
            has_more = False
            for res in valid_results:
                if isinstance(res, SearchResult):
                    all_items.extend(res.items)
                    total_items += res.total_count # This might double count if not careful
                    if res.has_more:
                        has_more = True # If any provider has more, flag it
            # Deduplicate items by id if possible
            unique_items_dict = {item.id: item for item in all_items}
            unique_items = list(unique_items_dict.values())

            # If using place_matcher_chain for consolidation as in find_places_nearby:
            # places_str = "\n".join([str(result.dict()) for result in valid_results]) # Assumes .dict() method
            # matched_places_payload = await self.place_matcher_chain.arun(places_str) # Expects JSON string output from LLM
            # matched_items = [PlaceDetails(**item_data) for item_data in json.loads(matched_places_payload)]
            # return SearchResult(items=matched_items, total_count=len(matched_items), has_more=False) # Simplified total_count

            return SearchResult(items=unique_items, total_count=len(unique_items), has_more=has_more)
        else:
            return SearchResult(items=[], total_count=0, has_more=False)


    async def get_place_details(self, item_id: str, source: str) -> PlaceDetails: # Renamed to align
        """Get place details from a specific source."""
        repo = self._get_repository_by_source(source)
        if not repo:
            raise ValueError(f"Unknown or unsupported source: {source}")

        if isinstance(repo, GoogleMapsRepository):
            return await repo.get_place_details(item_id) # Correct method name
        elif hasattr(repo, "get_details"): # For other repos that might use the old name
            return await repo.get_details(item_id)
        elif hasattr(repo, "get_place_details"): # For other repos that might use the new name
            return await repo.get_place_details(item_id)
        else:
            raise NotImplementedError(f"Method get_place_details not implemented for source {source}")


    async def get_directions( # Renamed from get_route to align with GoogleMapsRepository
        self,
        origin: GeoLocation, # GoogleMapsRepository expects models.location.Location
        destination: GeoLocation, # GoogleMapsRepository expects models.location.Location
        waypoints: Optional[List[GeoLocation]] = None, # GoogleMapsRepository expects List[models.location.Location]
        mode: str = "driving",
    ) -> Dict[str, Any]: # Keeping Dict[str, Any] for LLM processing, though GoogleMapsRepository returns Route object
        """Get optimal route using multiple providers, prioritizing Google Maps for now."""
        # Convert GeoLocation to Location for GoogleMapsRepository if other repos also use GeoLocation
        gmaps_origin = Location(latitude=origin.latitude, longitude=origin.longitude, address=origin.address)
        gmaps_destination = Location(latitude=destination.latitude, longitude=destination.longitude, address=destination.address)
        gmaps_waypoints: Optional[List[Location]] = None
        if waypoints:
            gmaps_waypoints = [Location(latitude=wp.latitude, longitude=wp.longitude, address=wp.address) for wp in waypoints]

        route_tasks = []
        for repo in self.repositories:
            if isinstance(repo, GoogleMapsRepository):
                task = repo.get_directions(origin=gmaps_origin, destination=gmaps_destination, waypoints=gmaps_waypoints, mode=mode)
            elif hasattr(repo, "get_route"): # Assuming other repos might have a get_route method
                 # Ensure these repos can handle GeoLocation inputs directly for get_route
                task = repo.get_route(origin=origin, destination=destination, waypoints=waypoints, mode=mode)
            elif hasattr(repo, "get_directions"): # If they adopted the new name
                # Ensure these repos can handle GeoLocation or convert as done for GoogleMaps
                task = repo.get_directions(origin=gmaps_origin, destination=gmaps_destination, waypoints=gmaps_waypoints, mode=mode)
            else:
                continue # Skip repo if no suitable directions method
            route_tasks.append(task)

        routes_results = await asyncio.gather(*route_tasks, return_exceptions=True)

        valid_routes = [r for r in routes_results if not isinstance(r, Exception) and r is not None]

        if not valid_routes:
            # Consider raising an error or returning a default response
            raise DirectionsError("No valid routes found from any provider.")


        # For now, return the first valid route (likely Google Maps if it's first and succeeds)
        # The LLM processing part is kept as is, assuming it can handle the Route object's string representation.
        # If the LLM needs a dict, the Route object should be converted (e.g., route.model_dump()).
        # The current implementation converts the Route object to string.

        # Example: if Google Maps result is preferred and available:
        gmaps_route_result = next((r for r in valid_routes if isinstance(r, Route)), None) # Route is from models.route
        if gmaps_route_result:
             # If LLM needs a dict: return gmaps_route_result.model_dump()
             # If LLM processes string representation (as per current chain):
             routes_str = str(gmaps_route_result) # Or more detailed string representation
        else:
            # Fallback if Google Maps route failed or other providers are used
            routes_str = "\n".join([str(route) for route in valid_routes])


        if not routes_str.strip(): # Check if routes_str is empty or only whitespace
            raise DirectionsError("No valid route data to process for optimization.")

        # Use LangChain to analyze and select the optimal route
        # The route_optimizer_chain expects a string of routes.
        # Ensure the string representation of Route object is suitable for the LLM.
        optimal_route_description = await self.route_optimizer_chain.arun(routes_str)

        # The LLM returns a description. The actual route data (e.g., from gmaps_route_result)
        # should also be returned or integrated. This example returns the LLM description.
        # A more complete solution would parse the LLM output or return structured data.
        return {"optimal_route_description": optimal_route_description, "preferred_route_data": gmaps_route_result.model_dump() if gmaps_route_result else None}

    async def geocode(
        self, address: str, prefer_source: Optional[str] = None
    ) -> GeoLocation:
        """Geocode address using multiple providers."""
        if prefer_source:
            repo = self._get_repository_by_source(prefer_source)
            if repo:
                try:
                    return await repo.geocode(address)
                except Exception as e:
                    # Log error and fall through to try other providers
                    logger.warning(f"Preferred geocoding source '{prefer_source}' failed for address '{address}': {e}", exc_info=True)
            else:
                logger.warning(f"Preferred geocoding source '{prefer_source}' not found or unsupported.")


        # Otherwise, try all providers
        geocode_tasks = []
        for repo in self.repositories:
            # Skip preferred_source if it already failed
            if prefer_source and prefer_source.lower() in str(type(repo)).lower():
                continue
            geocode_tasks.append(repo.geocode(address))

        results = await asyncio.gather(*geocode_tasks, return_exceptions=True)

        # Filter out any failed results
        results = await asyncio.gather(*geocode_tasks, return_exceptions=True)
        valid_results = [r for r in results if not isinstance(r, Exception) and r is not None]

        if not valid_results:
            raise GeocodingError(f"Could not geocode address: {address} from any provider.")

        # Resolve any conflicts in the results (assuming _resolve_conflicts exists)
        # For now, return the first valid result.
        # return await self._resolve_conflicts(valid_results) # If _resolve_conflicts is implemented
        return valid_results[0] # Placeholder for actual conflict resolution

    async def find_places_nearby(
        self,
        location: GeoLocation,
        radius: float = 1000,
        types: Optional[List[str]] = None,
    ) -> SearchResult:
        """Find places near a location using multiple providers."""
        # This method's original implementation calls repo.search with an empty query,
        # relying on location, radius, and types in filters.
        # This should be changed to call the consolidated self.search_places method.

        # We'll pass an empty query for "types" based search around a location.
        # The types parameter should be part of the filters dict for GoogleMapsRepository.

        # Construct filters for search_places
        current_filters = {"types": types} if types else {}
        # Note: self.search_places now directly accepts radius.

        # Call the class's own search_places method which handles provider iteration.
        # GeoLocation is the input type for self.search_places
        return await self.search_places(query="", location=location, radius=radius, filters=current_filters)

    def _get_repository_by_source(self, source_name: str) -> Optional[Any]:
        """Helper to get a repository instance by its string name."""
        source_name_lower = source_name.lower()
        for r in self.repositories:
            if source_name_lower in str(type(r)).lower():
                return r
        return None

    # Placeholder for _aggregate_results and _resolve_conflicts if they are to be implemented
    async def _aggregate_results(self, results: List[SearchResult]) -> SearchResult:
        # This is a very basic aggregation. A real one would be more complex.
        all_items = []
        total_count = 0
        has_more = False
        # Simple de-duplication by place ID
        seen_ids = set()

        for res in results:
            if isinstance(res, SearchResult):
                for item in res.items:
                    if item.id not in seen_ids:
                        all_items.append(item)
                        seen_ids.add(item.id)
                # total_count += res.total_count # This can be misleading if not careful
                if res.has_more:
                    has_more = True

        # Use LLM for matching/ranking if desired, or implement other logic.
        # For now, just return combined unique items.
        # This could also use self.place_matcher_chain for more advanced consolidation.
        return SearchResult(items=all_items, total_count=len(all_items), has_more=has_more)

    async def _resolve_conflicts(self, results: List[GeoLocation]) -> GeoLocation:
        # Basic conflict resolution: return the first result.
        # A more advanced one might average coordinates or use a preferred source.
        if not results:
            raise ValueError("No results to resolve.")
        # Example: Prefer Google Maps if available (assuming it's a known type or identified by content)
        # For now, just returning the first one.
        return results[0]
