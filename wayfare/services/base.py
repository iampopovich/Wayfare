from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

from models.base import GeoLocation, PlaceDetails, SearchResult


class BaseService(ABC):
    """Base class for all services with common LangChain integration."""

    def __init__(self, repositories: List[Any], model_name: str = "gpt-3.5-turbo"):
        self.repositories = repositories
        self.llm = ChatOpenAI(model_name=model_name)
        self._setup_chains()

    def _setup_chains(self):
        """Setup LangChain chains for various operations."""
        # Chain for result aggregation and ranking
        self.aggregator_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["results"],
                template="""
                Analyze and rank the following search results based on relevance,
                ratings, and overall quality:
                {results}
                Return a JSON array of ranked results with explanation for each ranking.
                """,
            ),
        )

        # Chain for conflict resolution
        self.resolver_chain = LLMChain(
            llm=self.llm,
            prompt=PromptTemplate(
                input_variables=["conflicts"],
                template="""
                Resolve conflicts in the following data from different sources:
                {conflicts}
                Return the most accurate consolidated information as JSON.
                """,
            ),
        )

    @abstractmethod
    async def search(
        self,
        query: str,
        location: Optional[GeoLocation] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> SearchResult:
        """Search across all repositories."""
        pass

    @abstractmethod
    async def get_details(self, item_id: str, source: str) -> PlaceDetails:
        """Get detailed information from a specific source."""
        pass

    async def _aggregate_results(self, results: List[SearchResult]) -> SearchResult:
        """Aggregate and rank results from multiple sources."""
        # Convert results to format suitable for LangChain
        results_str = "\n".join([str(result.dict()) for result in results])

        # Use LangChain to rank and aggregate results
        ranked_results = await self.aggregator_chain.arun(results_str)

        # Process and return aggregated results
        return SearchResult(
            items=ranked_results["items"],
            total_count=sum(r.total_count for r in results),
            metadata={"sources": [str(type(repo)) for repo in self.repositories]},
        )

    async def _resolve_conflicts(self, items: List[PlaceDetails]) -> PlaceDetails:
        """Resolve conflicts in data from different sources."""
        # Convert items to format suitable for LangChain
        items_str = "\n".join([str(item.dict()) for item in items])

        # Use LangChain to resolve conflicts
        resolved_data = await self.resolver_chain.arun(items_str)

        # Convert resolved data back to PlaceDetails
        return PlaceDetails(**resolved_data)
