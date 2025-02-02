from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

from wayfare.services.base import BaseService
from wayfare.models.base import GeoLocation, SearchResult, Accommodation
from wayfare.repositories.travel.booking import BookingRepository
from wayfare.repositories.travel.trip import TripRepository
from wayfare.repositories.travel.airbnb import AirbnbRepository


class TravelService(BaseService):
    """Service for coordinating between different travel providers."""
    
    def __init__(
        self,
        booking_key: str,
        trip_key: str,
        airbnb_key: str,
        model_name: str = "gpt-3.5-turbo"
    ):
        repositories = [
            BookingRepository(booking_key),
            TripRepository(trip_key),
            AirbnbRepository(airbnb_key)
        ]
        super().__init__(repositories, model_name)
        self._setup_travel_chains()

    def _setup_travel_chains(self):
        """Setup additional LangChain chains specific to travel."""
        # Chain for price analysis
        self.price_analyzer_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["accommodations"],
                template="""
                Analyze pricing for the following accommodations:
                {accommodations}
                Consider factors like location, amenities, ratings, and seasonality.
                Return price analysis with recommendations as JSON.
                """
            )
        )

        # Chain for accommodation matching
        self.accommodation_matcher_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["listings"],
                template="""
                Compare the following accommodation listings:
                {listings}
                Identify identical or similar properties across platforms.
                Return matched accommodations with price comparisons as JSON.
                """
            )
        )

    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResult:
        """Search across all travel providers."""
        # Perform parallel searches
        search_tasks = [
            repo.search(query, location, filters)
            for repo in self.repositories
        ]
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]
        
        # Aggregate and rank results
        return await self._aggregate_results(valid_results)

    async def get_details(
        self,
        item_id: str,
        source: str
    ) -> Accommodation:
        """Get accommodation details from a specific source."""
        # Find the appropriate repository
        repo = next(
            (r for r in self.repositories if source.lower() in str(type(r)).lower()),
            None
        )
        if not repo:
            raise ValueError(f"Unknown source: {source}")
        
        return await repo.get_details(item_id)

    async def compare_prices(
        self,
        accommodation_ids: List[Dict[str, str]],
        check_in: datetime,
        check_out: datetime,
        guests: int = 1
    ) -> Dict[str, Any]:
        """Compare prices across different providers for same/similar accommodations."""
        # Get details for each accommodation
        detail_tasks = [
            self.get_details(acc["id"], acc["source"])
            for acc in accommodation_ids
        ]
        accommodations = await asyncio.gather(*detail_tasks, return_exceptions=True)
        
        # Filter out any failed results
        valid_accommodations = [a for a in accommodations if not isinstance(a, Exception)]
        
        if not valid_accommodations:
            raise ValueError("Could not fetch details for any accommodation")
        
        # Use LangChain to analyze prices
        accommodations_str = "\n".join([str(acc.dict()) for acc in valid_accommodations])
        price_analysis = await self.price_analyzer_chain.arun(accommodations_str)
        
        return price_analysis

    async def find_similar_accommodations(
        self,
        reference_id: str,
        source: str,
        max_price_difference: float = 0.2
    ) -> SearchResult:
        """Find similar accommodations across all providers."""
        # Get reference accommodation details
        reference = await self.get_details(reference_id, source)
        
        # Search for similar accommodations
        search_tasks = [
            repo.search(
                query=reference.name,
                location=reference.location,
                filters={
                    "price_min": reference.price_range.min_price * (1 - max_price_difference),
                    "price_max": reference.price_range.min_price * (1 + max_price_difference),
                    "amenities": reference.amenities
                }
            )
            for repo in self.repositories
            if not source.lower() in str(type(repo)).lower()  # Exclude original source
        ]
        results = await asyncio.gather(*search_tasks, return_exceptions=True)
        
        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]
        
        # Match similar accommodations
        listings_str = "\n".join([str(result.dict()) for result in valid_results])
        matched_listings = await self.accommodation_matcher_chain.arun(listings_str)
        
        return SearchResult(
            items=matched_listings["items"],
            total_count=len(matched_listings["items"]),
            metadata={
                "reference_id": reference_id,
                "reference_source": source,
                "sources": [str(type(repo)) for repo in self.repositories]
            }
        )

    async def check_availability(
        self,
        accommodation_ids: List[Dict[str, str]],
        check_in: str,
        check_out: str,
        guests: int = 1
    ) -> Dict[str, Any]:
        """Check availability across multiple providers."""
        availability_tasks = []
        for acc in accommodation_ids:
            repo = next(
                (r for r in self.repositories if acc["source"].lower() in str(type(r)).lower()),
                None
            )
            if repo:
                availability_tasks.append(
                    repo.check_availability(acc["id"], check_in, check_out, guests)
                )
        
        results = await asyncio.gather(*availability_tasks, return_exceptions=True)
        
        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]
        
        return {
            "results": valid_results,
            "total_available": len([r for r in valid_results if r.get("available", False)])
        }

    async def get_reviews(
        self,
        accommodation_ids: List[Dict[str, str]],
        page: int = 1,
        limit: int = 10
    ) -> Dict[str, Any]:
        """Get reviews from multiple providers."""
        review_tasks = []
        for acc in accommodation_ids:
            repo = next(
                (r for r in self.repositories if acc["source"].lower() in str(type(r)).lower()),
                None
            )
            if repo:
                review_tasks.append(repo.get_reviews(acc["id"], page, limit))
        
        results = await asyncio.gather(*review_tasks, return_exceptions=True)
        
        # Filter out any failed results
        valid_results = [r for r in results if not isinstance(r, Exception)]
        
        # Use LangChain to analyze reviews
        reviews_str = "\n".join([str(result) for result in valid_results])
        analyzed_reviews = await self.parser_chain.arun(
            f"Analyze and summarize these reviews: {reviews_str}"
        )
        
        return {
            "reviews": valid_results,
            "summary": analyzed_reviews,
            "total_reviews": sum(len(r.get("reviews", [])) for r in valid_results)
        }
