from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

from wayfare.models.base import GeoLocation, PlaceDetails, SearchResult


class BaseRepository(ABC):
    """Base class for all repositories with common LangChain integration."""
    
    def __init__(self, api_key: str, model_name: str = "gpt-3.5-turbo"):
        self.api_key = api_key
        self.llm = ChatOpenAI(model_name=model_name)
        self._setup_chains()

    def _setup_chains(self):
        """Setup LangChain chains for various operations."""
        # Chain for parsing unstructured data
        self.parser_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["content"],
                template="""
                Parse the following content into a structured format:
                {content}
                Extract key details like names, addresses, prices, and amenities.
                Format the output as a JSON object.
                """
            )
        )

    @abstractmethod
    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search for places/accommodations."""
        pass

    @abstractmethod
    async def get_details(self, item_id: str) -> PlaceDetails:
        """Get detailed information about a specific item."""
        pass


class BaseMapsRepository(BaseRepository):
    """Base class for map service repositories."""

    @abstractmethod
    async def geocode(self, address: str) -> GeoLocation:
        """Convert address to coordinates."""
        pass

    @abstractmethod
    async def reverse_geocode(self, location: GeoLocation) -> str:
        """Convert coordinates to address."""
        pass

    @abstractmethod
    async def get_route(
        self,
        origin: GeoLocation,
        destination: GeoLocation,
        waypoints: Optional[List[GeoLocation]] = None,
        mode: str = "driving"
    ) -> Dict[str, Any]:
        """Get route between points."""
        pass


class BaseAccommodationRepository(BaseRepository):
    """Base class for accommodation service repositories."""

    @abstractmethod
    async def check_availability(
        self,
        item_id: str,
        check_in: str,
        check_out: str,
        guests: int = 1
    ) -> Dict[str, Any]:
        """Check accommodation availability."""
        pass

    @abstractmethod
    async def get_reviews(
        self,
        item_id: str,
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get accommodation reviews."""
        pass
