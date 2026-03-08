// Initialize map
let map = L.map('map').setView([55.7558, 37.6173], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let markersLayer = null;

// Store the current route data globally
let currentRouteData = null;

// Import vehicle form manager
import VehicleFormManager from './vehicleForms.js';

// Initialize vehicle form manager
const vehicleFormManager = new VehicleFormManager();

// Form handling
document.getElementById('transportationType').addEventListener('change', function(e) {
    const carDetails = document.getElementById('carDetails');
    const motorcycleDetails = document.getElementById('motorcycleDetails');
    
    carDetails.classList.add('d-none');
    motorcycleDetails.classList.add('d-none');
    
    if (e.target.value === 'car') {
        carDetails.classList.remove('d-none');
    } else if (e.target.value === 'motorcycle') {
        motorcycleDetails.classList.remove('d-none');
    }
});

document.getElementById('tripForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Validate transportation type
    const transportationType = document.getElementById('transportationType').value;
    if (transportationType === 'empty') {
        showError('Please select a transportation type');
        return;
    }

    // Show loading state
    showLoading();

    // Gather form data
    const formData = {
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        transportationType: transportationType,
        passengers: parseInt(document.getElementById('passengers').value) || 1,
        budget: {
            min: parseFloat(document.getElementById('minBudget').value),
            max: parseFloat(document.getElementById('maxBudget').value),
            currency: document.getElementById('currency').value
        },
        overnightStay: {
            required: document.getElementById('overnightStay').checked
        }
    };

    // Add vehicle specifications based on transport type
    const vehicleSpecs = vehicleFormManager.getVehicleSpecifications();
    if (vehicleSpecs) {
        if (transportationType === 'motorcycle') {
            formData.motorcycleSpecifications = vehicleSpecs;
        } else if (transportationType === 'car') {
            formData.carSpecifications = vehicleSpecs;
        }
    }

    try {
        // Call API
        const response = await fetch('/api/v1/travel/route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to plan trip');
        }

        // Update UI with results
        displayResults(data);
    } catch (error) {
        showError('Error planning trip: ' + error.message);
    } finally {
        hideLoading();
    }
});

function displayResults(data) {
    try {
        // Store the route data globally
        currentRouteData = data;

        // Clear previous results
        clearMap();

        // Make sure we have valid data before proceeding
        if (!data || !data.route) {
            throw new Error('Invalid route data received');
        }

        // Display route on map
        displayRoute(data.route);

        // Update all the details tabs
        if (data.route) displayRouteDetails(data.route);
        if (data.stops) displayStopsDetails(data.stops);
        if (data.weather) displayWeatherDetails(data.weather);
        if (data.costs && typeof data.costs === 'object') displayCostDetails(data.costs);
        if (data.health) displayHealthDetails(data.health);

        // Show share button if we have a valid route
        const shareButton = document.getElementById('shareRouteButton');
        if (shareButton) {
            shareButton.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error displaying results:', error);
        showError('Error displaying trip details: ' + error.message);
    }
}

function shareRoute() {
    if (!currentRouteData) {
        showError('No route available to share');
        return;
    }

    const { route, stops } = currentRouteData;

    // Start with origin
    const firstSegment = route.segments[0];
    let waypoints = [`${firstSegment.startLocation.latitude},${firstSegment.startLocation.longitude}`];

    // Add stops as waypoints
    if (stops && stops.length > 0) {
        const stopWaypoints = stops.map(stop =>
            `${stop.location.latitude},${stop.location.longitude}`
        );
        waypoints = waypoints.concat(stopWaypoints);
    }

    // Add destination
    const lastSegment = route.segments[route.segments.length - 1];
    waypoints.push(`${lastSegment.endLocation.latitude},${lastSegment.endLocation.longitude}`);

    // Create Google Maps URL
    const origin = waypoints.shift();
    const destination = waypoints.pop();
    const waypointsParam = waypoints.length > 0
        ? `&waypoints=${waypoints.join('|')}`
        : '';

    // Get travel mode
    const travelMode = document.getElementById('transportationType').value;
    const googleMapsMode = {
        'car': 'driving',
        'walking': 'walking',
        'bicycle': 'bicycling',
        'bus': 'transit',
        'train': 'transit'
    }[travelMode] || 'driving';

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypointsParam}&travelmode=${googleMapsMode}`;

    // Open in new tab
    window.open(googleMapsUrl, '_blank');
}

document.getElementById('shareRouteButton').addEventListener('click', shareRoute);

function displayRoute(route) {
    console.log('Route data:', route);
    clearMap();

    // Create markers and polyline layers
    routeLayer = L.layerGroup();
    markersLayer = L.layerGroup();

    // Add start and end markers
    const firstSegment = route.segments[0];
    const lastSegment = route.segments[route.segments.length - 1];

    const startMarker = L.marker([firstSegment.startLocation.latitude, firstSegment.startLocation.longitude])
        .bindPopup('Start: ' + (firstSegment.startLocation.address || 'Start point'));
    const endMarker = L.marker([lastSegment.endLocation.latitude, lastSegment.endLocation.longitude])
        .bindPopup('End: ' + (lastSegment.endLocation.address || 'End point'));

    markersLayer.addLayer(startMarker);
    markersLayer.addLayer(endMarker);

    // Create path from coordinates
    const pathCoordinates = route.pathPoints.map(point => [point[0], point[1]]);
    const routePath = L.polyline(pathCoordinates, {
        color: '#3388ff',
        weight: 5,
        opacity: 0.8
    });

    routeLayer.addLayer(routePath);

    // Add all layers to map
    routeLayer.addTo(map);
    markersLayer.addTo(map);

    // Fit map bounds to show entire route
    const bounds = routePath.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
}

function displayRouteDetails(route) {
    const container = document.getElementById('routeDetailsContent');
    if (!container) return;

    try {
        let html = `
            <h5>Route Summary</h5>
            <p><strong>Total Distance:</strong> ${formatDistance(route.totalDistance || 0)}</p>
            <p><strong>Estimated Time:</strong> ${formatDuration(route.totalDuration || 0)}</p>
        `;

        if (route.segments && route.segments.length > 0) {
            html += '<h5 class="mt-3">Route Segments</h5>';
            html += '<div class="list-group">';
            route.segments.forEach(segment => {
                html += createSegmentCard(segment);
            });
            html += '</div>';
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying route details:', error);
        container.innerHTML = '<div class="alert alert-danger">Error displaying route details</div>';
    }
}

function displayStopsDetails(stops) {
    const container = document.getElementById('stopsContent');
    if (!container) return;

    let html = '<div class="list-group">';
    stops.forEach(stop => {
        html += createStopCard(stop);
    });
    html += '</div>';

    container.innerHTML = html;
}

function displayWeatherDetails(weather) {
    try {
        const container = document.getElementById('weatherContent');
        if (!container) return;

        // Validate weather data
        if (!weather || (!weather.origin && !weather.destination)) {
            container.innerHTML = '<div class="alert alert-warning">Weather data is not available for this route.</div>';
            return;
        }

        let html = `
            <h5>Weather Forecast</h5>
        `;
        
        if (weather.origin) {
            html += `
                <div class="weather-card mb-3">
                    <h6>Origin Weather</h6>
                    <div class="current-weather">
                        <span class="weather-icon">🌡️</span>
                        <strong>${weather.origin.location}</strong><br>
                        Temperature: ${weather.origin.temperature}°C<br>
                        ${weather.origin.description}
                    </div>
                </div>
            `;
        }
        
        if (weather.destination) {
            html += `
                <div class="weather-card">
                    <h6>Destination Weather</h6>
                    <div class="current-weather">
                        <span class="weather-icon">🌡️</span>
                        <strong>${weather.destination.location}</strong><br>
                        Temperature: ${weather.destination.temperature}°C<br>
                        ${weather.destination.description}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying weather details:', error);
        if (container) {
            container.innerHTML = '<div class="alert alert-danger">Error displaying weather information</div>';
        }
    }
}

function displayCostDetails(costs) {
    try {
        const container = document.getElementById('costsContent');
        if (!container) return;

        // Validate costs data
        if (!costs || typeof costs !== 'object') {
            container.innerHTML = '<div class="alert alert-warning">Cost information is not available.</div>';
            return;
        }

        let html = `
            <h5>Cost Breakdown</h5>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Always show fuel costs first if present
        if (costs.fuelCost !== undefined && costs.fuelCost !== null) {
            html += `
                <tr>
                    <td>Fuel</td>
                    <td>${formatCurrency(costs.fuelCost, costs.currency)}</td>
                </tr>
            `;
        }

        // Show maintenance costs if present
        if (costs.maintenanceCost !== undefined && costs.maintenanceCost !== null) {
            html += `
                <tr>
                    <td>Maintenance</td>
                    <td>${formatCurrency(costs.maintenanceCost, costs.currency)}</td>
                </tr>
            `;
        }

        // Show food costs if present
        if (costs.foodCost !== undefined && costs.foodCost !== null) {
            html += `
                <tr>
                    <td>Food</td>
                    <td>${formatCurrency(costs.foodCost, costs.currency)}</td>
                </tr>
            `;
        }

        // Show water costs if present
        if (costs.waterCost !== undefined && costs.waterCost !== null) {
            html += `
                <tr>
                    <td>Water</td>
                    <td>${formatCurrency(costs.waterCost, costs.currency)}</td>
                </tr>
            `;
        }

        // Always display total cost
        html += `
                <tr class="table-primary">
                    <td><strong>Total</strong></td>
                    <td><strong>${formatCurrency(costs.totalCost || 0, costs.currency)}</strong></td>
                </tr>
            </tbody>
        </table>
        </div>`;

        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying cost details:', error);
        container.innerHTML = '<div class="alert alert-danger">Error displaying cost information</div>';
    }
}

function displayHealthDetails(health) {
    const container = document.getElementById('healthContent');
    if (!container) return;

    try {
        let html = `
            <h5>Health Impact</h5>
        `;
        
        if (health.totalCalories !== undefined) {
            html += `
                <div class="health-stat">
                    <div class="health-stat-value">${health.totalCalories}</div>
                    <div class="health-stat-label">Calories Burned</div>
                </div>
            `;
        }

        if (health.activityBreakdown) {
            html += `
                <h6 class="mt-3">Activity Breakdown</h6>
                <div class="activity-breakdown">
            `;
            Object.entries(health.activityBreakdown).forEach(([activity, calories]) => {
                html += `
                    <div class="activity-item">
                        <span>${activity}</span>
                        <span class="health-stat-value" style="font-size: 1rem;">${calories} cal</span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        container.innerHTML = html;
    } catch (error) {
        console.error('Error displaying health details:', error);
        container.innerHTML = '<div class="alert alert-danger">Error displaying health information</div>';
    }
}

function createSegmentCard(segment) {
    try {
        return `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${segment.startLocation.address || 'Start'} → ${segment.endLocation.address || 'End'}</h6>
                        <p class="mb-1">Distance: ${formatDistance(segment.distance || 0)}</p>
                        <p class="mb-1">Duration: ${formatDuration(segment.duration || 0)}</p>
                        ${segment.instructions && segment.instructions.length > 0 ? `
                            <small>
                                <strong>Instructions:</strong>
                                <ul class="mb-0">
                                    ${segment.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
                                </ul>
                            </small>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error creating segment card:', error);
        return '<div class="list-group-item">Error displaying segment</div>';
    }
}

function createStopCard(stop) {
    return `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${stop.type || 'Stop'}</h6>
                    <p class="mb-1">Location: ${stop.location.latitude}, ${stop.location.longitude}</p>
                    ${stop.duration ? `<p class="mb-1">Duration: ${formatDuration(stop.duration)}</p>` : ''}
                    ${stop.facilities ? `<p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>` : ''}
                </div>
            </div>
        </div>
    `;
}

function showLoading() {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Calculating...';
    }
}

function hideLoading() {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Calculate Route';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
    setTimeout(() => {
        errorDiv.classList.add('d-none');
    }, 5000);
}

function clearMap() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    if (markersLayer) {
        map.removeLayer(markersLayer);
    }
}

function formatDistance(meters) {
    if (typeof meters !== 'number' || isNaN(meters)) {
        return '0 km';
    }
    return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(minutes) {
    if (typeof minutes !== 'number' || isNaN(minutes)) {
        return '0h 0m';
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
}

function formatCurrency(amount, currency = 'USD') {
    if (typeof amount !== 'number' || isNaN(amount)) {
        return '$0.00';
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
    }).format(amount);
}
