from typing import Dict, Any, List, Optional
import logging
from langchain_community.tools import BraveSearch
from langchain_google_community import GoogleSearchAPIWrapper
from langchain_community.tools import DuckDuckGoSearchRun


from core.settings import settings

logger = logging.getLogger(__name__)


class SearchService:
    """Service for performing web searches using various search engines."""

    def __init__(self):
        self.search_engines = {}
        self._init_search_engines()

    def _init_search_engines(self):
        """Initialize available search engines."""
        # DuckDuckGo doesn't require API key
        self.search_engines["duckduckgo"] = DuckDuckGoSearchRun()

        # Initialize Google if API key is available
        if hasattr(settings, "GOOGLE_SEARCH_API_KEY"):
            self.search_engines["google"] = GoogleSearchAPIWrapper(
                google_api_key=settings.GOOGLE_SEARCH_API_KEY,
                google_cse_id=settings.GOOGLE_SEARCH_CX,
            )

        # Initialize Brave if API key is available
        if hasattr(settings, "BRAVE_SEARCH_API_KEY"):
            self.search_engines["brave"] = BraveSearch(
                api_key=settings.BRAVE_SEARCH_API_KEY
            )

    async def search(
        self,
        query: str,
        engines: List[str] = None,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform a search using specified engines.

        Args:
            query: Search query
            engines: List of search engines to use (default: all available)
            limit: Maximum number of results per engine
            filters: Optional filters for search results
        """
        if not engines:
            engines = list(self.search_engines.keys())

        results = []
        for engine in engines:
            if engine not in self.search_engines:
                logger.warning(f"Search engine {engine} not available")
                continue

            try:
                engine_results = await self._search_with_engine(
                    engine=engine, query=query, limit=limit, filters=filters
                )
                results.extend(engine_results)
            except Exception as e:
                logger.error(f"Error searching with {engine}: {str(e)}")

        return self._deduplicate_results(results)

    async def search_prices(
        self, query: str, currency: str = "USD", limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search specifically for prices and financial information.

        Args:
            query: Search query related to prices
            currency: Target currency for prices
            limit: Maximum number of results
        """
        # Add price-specific keywords to query
        price_query = f"{query} price cost {currency}"

        # Use filters to focus on price-related content
        filters = {
            "content_type": ["price", "shopping", "commerce"],
            "date_range": {"months": 6},  # Recent prices only
        }

        results = await self.search(
            query=price_query,
            engines=["duckduckgo"],  # DuckDuckGo works well for price searches
            limit=limit,
            filters=filters,
        )

        return self._extract_price_information(results)

    async def _search_with_engine(
        self,
        engine: str,
        query: str,
        limit: int,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Perform search with a specific engine."""
        search_wrapper = self.search_engines[engine]

        # Convert our filters to engine-specific format
        kwargs = self._prepare_engine_kwargs(engine, filters)

        # Most LangChain wrappers are synchronous
        results = search_wrapper.results(query, num_results=limit, **kwargs)

        # Normalize results to our format
        normalized = []
        for result in results:
            normalized.append(
                {
                    "title": result.get("title", ""),
                    "url": result.get("link", ""),
                    "snippet": result.get("snippet", ""),
                    "source": engine,
                    "metadata": result.get("metadata", {}),
                }
            )

        return normalized

    def _prepare_engine_kwargs(
        self, engine: str, filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Prepare engine-specific search parameters."""
        kwargs = {}
        if not filters:
            return kwargs

        if engine == "google":
            if "date_range" in filters:
                kwargs["date_restrict"] = filters["date_range"]
            if "content_type" in filters:
                kwargs["file_type"] = filters["content_type"]

        elif engine == "brave":
            if "date_range" in filters:
                kwargs["freshness"] = filters["date_range"]
            if "content_type" in filters:
                kwargs["search_type"] = filters["content_type"]

        return kwargs

    def _deduplicate_results(
        self, results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Remove duplicate results based on URL."""
        seen_urls = set()
        unique_results = []

        for result in results:
            url = result["url"]
            if url not in seen_urls:
                seen_urls.add(url)
                unique_results.append(result)

        return unique_results

    def _extract_price_information(
        self, results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Extract and normalize price information from search results."""
        price_results = []

        for result in results:
            # Try to extract price from title and snippet
            title_price = self._find_price_in_text(result["title"])
            snippet_price = self._find_price_in_text(result["snippet"])

            if title_price or snippet_price:
                price_results.append(
                    {
                        "title": result["title"],
                        "url": result["url"],
                        "price": title_price or snippet_price,
                        "description": result["snippet"],
                        "source": result["source"],
                    }
                )

        return price_results

    def _find_price_in_text(self, text: str) -> Optional[float]:
        """Extract price from text using simple pattern matching."""
        import re

        # Look for common price patterns
        patterns = [
            r"\$\s*(\d+(?:\.\d{2})?)",  # $XX.XX
            r"(\d+(?:\.\d{2})?)\s*USD",  # XX.XX USD
            r"USD\s*(\d+(?:\.\d{2})?)",  # USD XX.XX
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    return float(match.group(1))
                except ValueError:
                    continue

        return None
