from typing import List, Optional, Dict, Any
import googlemaps
from langchain.tools import GooglePlacesTool
from langchain.agents import AgentType, initialize_agent
from langchain_openai import ChatOpenAI

from wayfare.repositories.base import BaseMapsRepository
from wayfare.models.base import GeoLocation, PlaceDetails, SearchResult


class GoogleMapsRepository(BaseMapsRepository):
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo"):
        super().__init__(api_key, model_name)
        self.client = googlemaps.Client(key=api_key)
        
        # Setup LangChain tools and agent
        places_tool = GooglePlacesTool(api_key=api_key)
        self.agent = initialize_agent(
            tools=[places_tool],
            llm=ChatOpenAI(model_name=model_name),
            agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
            verbose=True
        )

    async def geocode(self, address: str) -> GeoLocation:
        """Convert address to coordinates using Google Maps API."""
        result = self.client.geocode(address)
        if not result:
            raise ValueError(f"No results found for address: {address}")
        
        location = result[0]['geometry']['location']
        return GeoLocation(
            latitude=location['lat'],
            longitude=location['lng'],
            address=result[0]['formatted_address']
        )

    async def reverse_geocode(self, location: GeoLocation) -> str:
        """Convert coordinates to address using Google Maps API."""
        result = self.client.reverse_geocode((location.latitude, location.longitude))
        if not result:
            raise ValueError(f"No results found for location: {location}")
        return result[0]['formatted_address']

    async def get_route(
        self,
        origin: GeoLocation,
        destination: GeoLocation,
        waypoints: Optional[List[GeoLocation]] = None,
        mode: str = "driving"
    ) -> Dict[str, Any]:
        """Get route between points using Google Maps API."""
        waypoints_coords = None
        if waypoints:
            waypoints_coords = [(w.latitude, w.longitude) for w in waypoints]

        result = self.client.directions(
            origin=(origin.latitude, origin.longitude),
            destination=(destination.latitude, destination.longitude),
            mode=mode,
            waypoints=waypoints_coords
        )

        if not result:
            raise ValueError("No route found")

        return {
            "distance": result[0]['legs'][0]['distance']['value'],
            "duration": result[0]['legs'][0]['duration']['value'],
            "steps": result[0]['legs'][0]['steps'],
            "polyline": result[0]['overview_polyline']['points']
        }

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for places using Google Maps API and LangChain agent."""
        # Use LangChain agent for enhanced search capabilities
        agent_query = f"Find places matching '{query}'"
        if location:
            agent_query += f" near {location.latitude}, {location.longitude}"
        if filters:
            agent_query += f" with filters: {filters}"

        agent_result = await self.agent.arun(agent_query)
        
        # Process agent results and convert to SearchResult
        places_results = self.client.places(
            query,
            location=(location.latitude, location.longitude) if location else None,
            **filters or {}
        )

        items = []
        for place in places_results['results']:
            items.append(PlaceDetails(
                id=place['place_id'],
                name=place['name'],
                location=GeoLocation(
                    latitude=place['geometry']['location']['lat'],
                    longitude=place['geometry']['location']['lng']
                ),
                rating=place.get('rating'),
                photos=[photo['photo_reference'] for photo in place.get('photos', [])]
            ))

        return SearchResult(
            items=items,
            total_count=len(items),
            has_more='next_page_token' in places_results
        )

    async def get_details(self, item_id: str) -> PlaceDetails:
        """Get detailed information about a specific place."""
        place = self.client.place(item_id)
        
        return PlaceDetails(
            id=place['place_id'],
            name=place['name'],
            location=GeoLocation(
                latitude=place['geometry']['location']['lat'],
                longitude=place['geometry']['location']['lng'],
                address=place.get('formatted_address')
            ),
            rating=place.get('rating'),
            reviews_count=place.get('user_ratings_total'),
            photos=[photo['photo_reference'] for photo in place.get('photos', [])],
            amenities=place.get('types', []),
            metadata={
                'phone': place.get('formatted_phone_number'),
                'website': place.get('website'),
                'opening_hours': place.get('opening_hours', {}).get('weekday_text', [])
            }
        )
