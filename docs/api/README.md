# Wayfare API Documentation

## Overview

Wayfare is an AI-powered travel planning API that provides comprehensive travel itineraries including routes, costs, stops, and recommendations.

**Base URL:** `/api/v1`

**Swagger UI:** `/api/docs`

---

## Authentication

Most endpoints are public and do not require authentication. Some administrative endpoints may require an API key passed in the `X-API-Key` header.

---

## Endpoints

### Maps Endpoints

#### Search Places
```
GET /api/v1/maps/search
```

Search for places by query with optional location and radius filters.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | Search query (e.g., "restaurant") |
| latitude | number | No | Latitude for location-based search |
| longitude | number | No | Longitude for location-based search |
| radius | number | No | Search radius in meters (max 50000) |
| source | string | No | Data source: "google", "osm", or "all" (default: "all") |

**Response:**
```json
{
  "query": "restaurant",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.006
  },
  "results": [
    {
      "id": "place_id_123",
      "name": "Restaurant Name",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.006,
        "address": "123 Main St, New York, NY"
      },
      "rating": 4.5,
      "source": "google"
    }
  ],
  "totalCount": 10,
  "hasMore": true
}
```

#### Get Place Details
```
GET /api/v1/maps/place/:placeId
```

Get detailed information about a specific place by ID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| placeId | string | Yes | Place ID from search results |
| source | string | No | Data source: "google" or "osm" (default: "google") |

**Response:**
```json
{
  "id": "place_id_123",
  "name": "Restaurant Name",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.006,
    "address": "123 Main St, New York, NY"
  },
  "rating": 4.5,
  "reviewsCount": 150,
  "photos": ["photo_url_1", "photo_url_2"],
  "amenities": ["restaurant", "food", "dining"],
  "metadata": {
    "priceLevel": 2,
    "openingHours": {...},
    "website": "https://example.com"
  }
}
```

#### Get Directions
```
GET /api/v1/maps/directions
```

Get directions between origin and destination with optional waypoints.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| origin | string | Yes | Starting point address |
| destination | string | Yes | Destination address |
| mode | string | No | Travel mode: "driving", "walking", "bicycling", "transit" |
| waypoints | string | No | Comma-separated list of waypoint addresses |

**Response:**
```json
{
  "segments": [
    {
      "startLocation": {
        "latitude": 40.7128,
        "longitude": -74.006,
        "address": "New York, NY"
      },
      "endLocation": {
        "latitude": 42.3601,
        "longitude": -71.0589,
        "address": "Boston, MA"
      },
      "distance": 346000,
      "duration": 240,
      "polyline": "encoded_polyline_string",
      "instructions": ["Head north on Main St", "Merge onto I-95 N"]
    }
  ],
  "totalDistance": 346000,
  "totalDuration": 240,
  "pathPoints": [[40.7128, -74.006], [42.3601, -71.0589]]
}
```

---

### Travel Endpoints

#### Plan Travel Route
```
POST /api/v1/travel/route
```

Plan a complete travel itinerary with route, costs, stops, and recommendations.

**Request Body:**
```json
{
  "origin": "New York, NY",
  "destination": "Boston, MA",
  "transportationType": "car",
  "passengers": 2,
  "carSpecifications": {
    "fuelConsumption": 7.5,
    "fuelType": "gasoline",
    "tankCapacity": 60,
    "initialFuel": 60
  },
  "preferDirectRoutes": true,
  "budget": {
    "min": 100,
    "max": 500
  }
}
```

**Response:**
```json
{
  "route": {
    "segments": [...],
    "totalDistance": 346000,
    "totalDuration": 240
  },
  "costs": {
    "totalCost": 85.50,
    "currency": "USD",
    "fuelCost": 38.50,
    "foodCost": 30.00,
    "waterCost": 12.00,
    "maintenanceCost": 5.00
  },
  "stops": [
    {
      "location": {
        "latitude": 41.3083,
        "longitude": -72.9279
      },
      "type": "rest",
      "duration": 15,
      "facilities": ["parking", "restroom"]
    }
  ],
  "health": {
    "totalCalories": 0,
    "activityBreakdown": {}
  },
  "weather": {
    "origin": {...},
    "destination": {...}
  },
  "recommendations": [
    "Take regular breaks every 2 hours",
    "Check weather conditions before departure"
  ],
  "metadata": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "transportationType": "car",
    "passengers": 2
  }
}
```

---

### Health Endpoints

#### Liveness Check
```
GET /api/v1/health/live
```

Check if the application is alive and running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Readiness Check
```
GET /api/v1/health/ready
```

Check if the application is ready to accept requests.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "server": "ok"
  }
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/travel/route",
  "method": "POST",
  "message": "Origin and destination are required",
  "error": "Bad Request"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/maps/place/invalid-id",
  "method": "GET",
  "message": "Place not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/v1/travel/route",
  "method": "POST",
  "message": "Failed to plan travel: API error",
  "error": "Internal Server Error"
}
```

---

## Rate Limiting

API requests are rate-limited to ensure fair usage. If you exceed the rate limit, you'll receive a `429 Too Many Requests` response.

---

## Data Sources

Wayfare aggregates data from multiple sources:
- **Google Maps**: Primary source for places, directions, and geocoding
- **OpenStreetMap (OSM)**: Fallback source for maps data
- **OpenWeatherMap**: Weather data and forecasts

The `source` parameter allows you to specify which data source to use, or use "all" to get aggregated results from multiple sources.
