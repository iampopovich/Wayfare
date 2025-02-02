from typing import List, Optional, Dict, Any
import osmnx as ox
from langchain.tools import Tool
from langchain.agents import AgentType, initialize_agent

from wayfare.repositories.base import BaseMapsRepository
from wayfare.models.base import GeoLocation, PlaceDetails, SearchResult


class OSMRepository(BaseMapsRepository):
    def __init__(self, api_key: str = None, model_name: str = "gpt-3.5-turbo"):
        super().__init__(api_key or "", model_name)
        # Configure OSMnx
        ox.config(use_cache=True, log_console=False)
        
        # Create custom LangChain tools for OSM
        osm_tools = [
            Tool(
                name="search_osm",
                func=self._search_osm,
                description="Search for places in OpenStreetMap"
            ),
            Tool(
                name="get_osm_details",
                func=self._get_osm_details,
                description="Get detailed information about a place from OpenStreetMap"
            )
        ]
        
        self.agent = initialize_agent(
            tools=osm_tools,
            llm=self.llm,
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True
        )

    def _search_osm(self, query: str, location: Optional[GeoLocation] = None) -> Dict:
        """Internal method to search OSM."""
        if location:
            gdf = ox.geometries_from_point(
                (location.latitude, location.longitude),
                tags={'name': query}
            )
        else:
            gdf = ox.geometries_from_place(query)
        
        return gdf.to_dict()

    def _get_osm_details(self, item_id: str) -> Dict:
        """Internal method to get OSM details."""
        return ox.geometries_from_place(item_id).to_dict()

    async def geocode(self, address: str) -> GeoLocation:
        """Convert address to coordinates using OSM Nominatim."""
        location = ox.geocode(address)
        return GeoLocation(
            latitude=location[0],
            longitude=location[1],
            address=address
        )

    async def reverse_geocode(self, location: GeoLocation) -> str:
        """Convert coordinates to address using OSM Nominatim."""
        address = ox.reverse_geocode(
            (location.latitude, location.longitude)
        )
        return address

    async def get_route(
        self,
        origin: GeoLocation,
        destination: GeoLocation,
        waypoints: Optional[List[GeoLocation]] = None,
        mode: str = "driving"
    ) -> Dict[str, Any]:
        """Get route between points using OSM."""
        # Get network around points
        points = [(origin.latitude, origin.longitude),
                 (destination.latitude, destination.longitude)]
        if waypoints:
            points.extend([(w.latitude, w.longitude) for w in waypoints])

        G = ox.graph_from_point(
            points[0],
            dist=max([ox.distance.great_circle_vec(points[0][0], points[0][1],
                                                 p[0], p[1]) for p in points]) + 1000,
            network_type=mode
        )

        # Get route
        route = ox.shortest_path(
            G,
            ox.nearest_nodes(G, origin.latitude, origin.longitude),
            ox.nearest_nodes(G, destination.latitude, destination.longitude)
        )

        # Calculate distance and duration
        edge_lengths = ox.utils_graph.get_route_edge_attributes(G, route, 'length')
        distance = sum(edge_lengths)

        return {
            "distance": distance,
            "duration": distance / (5 if mode == "walking" else 50),  # Rough estimation
            "route": route,
            "network": G
        }

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for places using OSM."""
        agent_query = f"Find places in OpenStreetMap matching '{query}'"
        if location:
            agent_query += f" near {location.latitude}, {location.longitude}"
        if filters:
            agent_query += f" with filters: {filters}"

        results = await self.agent.arun(agent_query)
        
        # Process results
        if location:
            gdf = ox.geometries_from_point(
                (location.latitude, location.longitude),
                tags={'name': query, **filters} if filters else {'name': query}
            )
        else:
            gdf = ox.geometries_from_place(query)

        items = []
        for idx, row in gdf.iterrows():
            items.append(PlaceDetails(
                id=str(idx),
                name=row.get('name', ''),
                location=GeoLocation(
                    latitude=row.geometry.centroid.y,
                    longitude=row.geometry.centroid.x
                ),
                metadata={k: v for k, v in row.items() if k not in ['geometry', 'name']}
            ))

        return SearchResult(
            items=items,
            total_count=len(items),
            has_more=False  # OSM doesn't have pagination
        )

    async def get_details(self, item_id: str) -> PlaceDetails:
        """Get detailed information about a specific place."""
        result = await self.agent.arun(f"Get details for OpenStreetMap place {item_id}")
        
        # Parse the result using LangChain
        parsed_result = await self.parser_chain.arun(result)
        
        # Convert parsed result to PlaceDetails
        return PlaceDetails(**parsed_result)
