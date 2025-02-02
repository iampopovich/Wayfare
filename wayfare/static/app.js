// Initialize map
let map = L.map('map').setView([55.7558, 37.6173], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;
let markersLayer = null;

// Store the current route data globally
let currentRouteData = null;

// Form handling
document.getElementById('transportationType').addEventListener('change', function(e) {
    const carDetails = document.getElementById('carDetails');
    if (e.target.value === 'car') {
        carDetails.classList.remove('d-none');
    } else {
        carDetails.classList.add('d-none');
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
        transportation_type: transportationType,
        passengers: parseInt(document.getElementById('passengers').value),
        budget: {
            min_amount: parseFloat(document.getElementById('minBudget').value),
            max_amount: parseFloat(document.getElementById('maxBudget').value),
            currency: document.getElementById('currency').value
        },
        overnight_stay: {
            required: document.getElementById('overnightStay').checked
        }
    };

    // Add car specifications if transport type is car
    if (formData.transportation_type === 'car') {
        formData.car_specifications = {
            model: document.getElementById('carModel').value || 'Standard 1.6L',
            engine_volume: parseFloat(document.getElementById('engineVolume').value) || 1.6,
            fuel_consumption: parseFloat(document.getElementById('fuelConsumption').value) || 11.0,
            fuel_type: document.getElementById('fuelType').value || 'gasoline',
            tank_capacity: parseFloat(document.getElementById('tankCapacity').value) || 50.0,
            initial_fuel: parseFloat(document.getElementById('initialFuel').value) || 25.0,
            base_mass: 1200.0,
            passenger_mass: 75.0
        };
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
            throw new Error(data.detail || 'Failed to plan trip');
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
    // Store the route data globally
    currentRouteData = data;
    
    // Clear previous results
    clearMap();
    
    // Display route on map
    displayRoute(data.route);
    
    // Update route details tab
    displayRouteDetails(data.route);
    
    // Update stops tab
    if (data.stops && data.stops.length > 0) {
        displayStopsDetails(data.stops);
    }
    
    // Update weather tab
    if (data.weather) {
        displayWeatherDetails(data.weather);
    }
    
    // Update costs tab
    displayCostDetails(data.costs);
    
    // Update health tab
    displayHealthDetails(data.health);
    
    // Show share button
    document.getElementById('shareRouteButton').classList.remove('d-none');
}

function shareRoute() {
    if (!currentRouteData) {
        showError('No route available to share');
        return;
    }

    const { route, stops } = currentRouteData;
    
    // Start with origin
    const firstSegment = route.segments[0];
    let waypoints = [`${firstSegment.start_location.latitude},${firstSegment.start_location.longitude}`];
    
    // Add stops as waypoints
    if (stops && stops.length > 0) {
        const stopWaypoints = stops.map(stop => 
            `${stop.location.latitude},${stop.location.longitude}`
        );
        waypoints = waypoints.concat(stopWaypoints);
    }
    
    // Add destination
    const lastSegment = route.segments[route.segments.length - 1];
    waypoints.push(`${lastSegment.end_location.latitude},${lastSegment.end_location.longitude}`);
    
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

    const startMarker = L.marker([firstSegment.start_location.latitude, firstSegment.start_location.longitude])
        .bindPopup('Start: ' + firstSegment.start_location.address);
    const endMarker = L.marker([lastSegment.end_location.latitude, lastSegment.end_location.longitude])
        .bindPopup('End: ' + lastSegment.end_location.address);

    markersLayer.addLayer(startMarker);
    markersLayer.addLayer(endMarker);

    // Add refueling and rest stops if they exist
    if (route.segments) {
        console.log('Processing segments for stops:', route.segments);
        route.segments.forEach((segment, index) => {
            if (segment.refueling_stop) {
                console.log('Found refueling stop in segment:', index, segment.refueling_stop);
                const stop = segment.refueling_stop;
                
                // Create gas station marker
                const markerColor = '#e74c3c';  // Red color
                const markerIcon = L.divIcon({
                    html: `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 12px; display: flex; justify-content: center; align-items: center;">⛽</div>`,
                    className: 'custom-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 24],
                    popupAnchor: [0, -24]
                });

                const marker = L.marker([stop.location.latitude, stop.location.longitude], {
                    icon: markerIcon
                }).bindPopup(createStopPopup(stop));
                
                markersLayer.addLayer(marker);
            }
        });
    }

    // Create path from coordinates
    const pathCoordinates = route.path_points.map(point => [point[0], point[1]]);
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

function displayStopsDetails(stops) {
    console.log('Displaying stops details:', stops);
    const container = document.getElementById('stopsDetails');
    
    if (!stops || stops.length === 0) {
        container.innerHTML = '<p>No stops planned for this journey.</p>';
        return;
    }

    // Group stops by type
    const stopsByType = stops.reduce((acc, stop) => {
        const type = stop.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(stop);
        return acc;
    }, {});

    container.innerHTML = `
        <div class="result-card">
            ${Object.entries(stopsByType).map(([type, typeStops]) => `
                <div class="mb-4">
                    <h5 class="result-title">${type.charAt(0).toUpperCase() + type.slice(1)} Stops</h5>
                    ${typeStops.map((stop, index) => `
                        <div class="stop-card mb-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <h6>${type.charAt(0).toUpperCase() + type.slice(1)} Stop ${index + 1}</h6>
                                    <p class="mb-1">Location: ${stop.location.address || 'Unknown location'}</p>
                                    ${stop.distance_from_start ? `
                                        <p class="mb-1">Distance: ${formatDistance(stop.distance_from_start)}</p>
                                    ` : ''}
                                    ${stop.duration ? `
                                        <p class="mb-1">Duration: ${formatDuration(stop.duration)}</p>
                                    ` : ''}
                                    ${stop.facilities && stop.facilities.length > 0 ? `
                                        <p class="mb-1">Facilities: ${stop.facilities.join(', ')}</p>
                                    ` : ''}
                                    ${stop.type === 'refueling' ? `
                                        <p class="mb-1">Fuel level on arrival: ${stop.fuel_level_before.toFixed(1)}L</p>
                                        <p class="mb-1">Refuel amount: ${stop.fuel_needed.toFixed(1)}L</p>
                                        ${stop.estimated_cost ? `
                                            <p class="mb-1">Estimated cost: ${formatCurrency(stop.estimated_cost.amount, stop.estimated_cost.currency)}</p>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function createStopPopup(stop) {
    let content = `<div class="stop-popup">
        <h6>${stop.name || 'Stop'}</h6>
        <p class="mb-1">Distance: ${formatDistance(stop.distance_from_start)}</p>`;

    if (stop.fuel_needed > 0) {
        content += `
            <p class="mb-1">Fuel level on arrival: ${stop.fuel_level_before.toFixed(1)}L</p>
            <p class="mb-1">Refuel amount: ${stop.fuel_needed.toFixed(1)}L</p>`;
    }

    if (stop.rest_time_needed) {
        content += `<p class="mb-1">Rest time: ${stop.rest_time_needed} minutes</p>`;
    }

    if (stop.facilities && stop.facilities.length > 0) {
        content += `<p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>`;
    }

    content += '</div>';
    return content;
}

function displayRouteDetails(route) {
    const container = document.getElementById('routeDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Route Summary</h5>
            <div class="result-detail">
                <p><strong>Total Distance:</strong> ${formatDistance(route.total_distance)}</p>
                <p><strong>Total Duration:</strong> ${formatDuration(route.total_duration)}</p>
            </div>
            <div class="route-segments mt-3">
                <h6>Route Segments</h6>
                ${route.segments.map((segment, index) => `
                    <div class="segment-card mb-2">
                        <div class="segment-header">
                            <strong>Segment ${index + 1}</strong>
                        </div>
                        <div class="segment-details">
                            <p class="mb-1"><small>From: ${segment.start_location.address || 'Start'}</small></p>
                            <p class="mb-1"><small>To: ${segment.end_location.address || 'End'}</small></p>
                            <p class="mb-1"><small>Distance: ${formatDistance(segment.distance)}</small></p>
                            <p class="mb-1"><small>Duration: ${formatDuration(segment.duration)}</small></p>
                        </div>
                        ${segment.instructions.length > 0 ? `
                            <div class="segment-instructions">
                                <small>
                                    <strong>Instructions:</strong>
                                    <ul class="mb-0">
                                        ${segment.instructions.map(instruction => `
                                            <li>${instruction}</li>
                                        `).join('')}
                                    </ul>
                                </small>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function displayAccommodationDetails(accommodation) {
    const container = document.getElementById('accommodationDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Recommended Stays</h5>
            ${accommodation.recommended_stays.map(stay => createAccommodationCard(stay)).join('')}
        </div>
    `;
}

function displayCostDetails(costs) {
    const container = document.getElementById('costsDetails');
    console.log('Displaying cost details:', costs);
    
    // Define all possible cost types with their display names
    const costTypes = {
        fuel_cost: 'Fuel',
        ticket_cost: 'Tickets',
        food_cost: 'Food',
        water_cost: 'Water',
        accommodation_cost: 'Accommodation',
        toll_cost: 'Road Tolls',
        parking_cost: 'Parking',
        maintenance_cost: 'Vehicle Maintenance',
        rest_stop_cost: 'Rest Stops',
        other_cost: 'Other Expenses'
    };

    // Create cost items array from all available costs
    const costItems = Object.entries(costs)
        .filter(([key, value]) => 
            key in costTypes && // Only include known cost types
            value !== null && 
            value !== undefined && 
            value !== 0 && 
            key !== 'total_cost' && // Exclude total cost as it's shown separately
            key !== 'currency' // Exclude currency as it's not a cost
        )
        .map(([key, value]) => ({
            category: costTypes[key],
            amount: value,
            key: key
        }));

    // Sort cost items by amount (highest first)
    costItems.sort((a, b) => b.amount - a.amount);

    // Additional details for car travel
    const carDetails = [];
    if (costs.fuel_consumption) carDetails.push(`Fuel consumption: ${costs.fuel_consumption.toFixed(1)}L`);
    if (costs.refueling_stops) carDetails.push(`Refueling stops needed: ${costs.refueling_stops}`);
    
    // Get car specifications from the form if it's a car journey
    const transportationType = document.getElementById('transportationType').value;
    if (transportationType === 'car') {
        const passengers = parseInt(document.getElementById('passengers').value);
        const baseMass = 1200; // kg
        const passengerMass = 75; // kg per passenger
        const totalMass = baseMass + (passengerMass * passengers);
        
        carDetails.unshift(
            `Vehicle mass: ${baseMass}kg`,
            `Passengers: ${passengers} × ${passengerMass}kg = ${passengerMass * passengers}kg`,
            `Total mass: ${totalMass}kg`
        );
    }

    // Calculate the sum of all individual costs
    const sumOfCosts = costItems.reduce((sum, item) => sum + item.amount, 0);
    const totalCost = costs.total_cost || sumOfCosts;

    // Check if there's a difference between total and sum of items
    const unexplainedCosts = totalCost - sumOfCosts;

    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Cost Breakdown</h5>
            <div class="cost-breakdown">
                ${costItems.map(item => `
                    <div class="cost-item">
                        <span class="cost-label">${item.category}</span>
                        <span class="cost-value">${formatCurrency(item.amount, costs.currency)}</span>
                    </div>
                `).join('')}
                ${unexplainedCosts > 0 ? `
                    <div class="cost-item text-warning">
                        <span class="cost-label">Additional Costs</span>
                        <span class="cost-value">${formatCurrency(unexplainedCosts, costs.currency)}</span>
                        <small class="d-block text-muted">These costs may include service fees, taxes, or other miscellaneous expenses</small>
                    </div>
                ` : ''}
            </div>
            ${carDetails.length > 0 ? `
                <div class="car-details mt-3">
                    <h6>Journey Details</h6>
                    ${carDetails.map(detail => `<p class="mb-1">${detail}</p>`).join('')}
                </div>
            ` : ''}
            <div class="mt-3">
                <h6>Total Cost</h6>
                <div class="cost-item total-cost">
                    <span class="cost-value">${formatCurrency(totalCost, costs.currency)}</span>
                </div>
            </div>
        </div>
    `;
}

function displayHealthDetails(health) {
    const container = document.getElementById('healthDetails');
    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Health Impact</h5>
            <div class="health-details">
                <p><strong>Total Calories Burned:</strong> ${Math.round(health.total_calories)} kcal</p>
                <div class="activity-breakdown mt-3">
                    <h6>Activity Breakdown</h6>
                    ${Object.entries(health.activity_breakdown).map(([activity, calories]) => `
                        <div class="activity-item">
                            <span class="activity-label text-capitalize">${activity}</span>
                            <span class="activity-value">${Math.round(calories)} kcal</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function displayWeatherDetails(weather) {
    console.log('Displaying weather details:', weather);
    const container = document.getElementById('weatherDetails');
    
    if (!weather || (!weather.origin && !weather.destination)) {
        console.warn('No weather data available');
        container.innerHTML = '<p>Weather data not available.</p>';
        return;
    }

    const createWeatherCard = (locationData, title) => {
        console.log(`Creating weather card for ${title}:`, locationData);
        return `
            <div class="weather-card mb-4">
                <h6 class="mb-3">${title} - ${locationData.location}</h6>
                
                <div class="current-weather mb-3">
                    <h6 class="text-muted">Current Conditions</h6>
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <p class="mb-1">Temperature: ${locationData.weather.current.temperature}°C</p>
                            <p class="mb-1">Wind Speed: ${locationData.weather.current.wind_speed} m/s</p>
                            <p class="mb-0">Time: ${new Date(locationData.weather.current.time).toLocaleString()}</p>
                        </div>
                        <div class="weather-icon">
                            ${locationData.weather.current.temperature > 20 ? '☀️' : 
                              locationData.weather.current.temperature < 0 ? '❄️' : '⛅'}
                        </div>
                    </div>
                </div>
                
                <div class="forecast">
                    <h6 class="text-muted">24-Hour Forecast</h6>
                    <div class="forecast-chart">
                        <canvas id="${title.toLowerCase()}-chart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="result-card">
            <h5 class="result-title">Weather Conditions</h5>
            
            ${weather.origin ? createWeatherCard(weather.origin, 'Origin') : ''}
            ${weather.destination ? createWeatherCard(weather.destination, 'Destination') : ''}
            
            ${weather.recommendations && weather.recommendations.length > 0 ? `
                <div class="weather-recommendations mt-3">
                    <h6 class="text-muted">Weather Recommendations</h6>
                    <ul class="list-unstyled">
                        ${weather.recommendations.map(rec => `
                            <li class="mb-2">
                                <i class="bi bi-info-circle text-primary"></i>
                                ${rec}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;

    // Create charts if weather data is available
    if (weather.origin) {
        console.log('Creating origin weather chart with data:', weather.origin.weather.forecast);
        createWeatherChart(
            'origin-chart',
            weather.origin.weather.forecast
        );
    }
    
    if (weather.destination) {
        console.log('Creating destination weather chart with data:', weather.destination.weather.forecast);
        createWeatherChart(
            'destination-chart',
            weather.destination.weather.forecast
        );
    }
}

function createWeatherChart(canvasId, forecast) {
    console.log(`Creating weather chart for ${canvasId}:`, forecast);
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error(`Canvas element ${canvasId} not found`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error(`Could not get 2D context for ${canvasId}`);
        return;
    }
    
    // Format times for display
    const labels = forecast.times.map(time => {
        const date = new Date(time);
        if (isNaN(date.getTime())) {
            console.error(`Invalid time value: ${time}`);
            return time;
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    console.log('Chart labels:', labels);
    console.log('Temperature data:', forecast.temperatures);
    console.log('Humidity data:', forecast.humidity);
    console.log('Wind speed data:', forecast.wind_speed);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: forecast.temperatures,
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: 'Humidity (%)',
                    data: forecast.humidity,
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.1,
                    yAxisID: 'y1'
                },
                {
                    label: 'Wind Speed (m/s)',
                    data: forecast.wind_speed,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    yAxisID: 'y2'
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Wind Speed (m/s)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Utility functions
function formatDistance(meters) {
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
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'  // Default to USD if currency is not provided
    }).format(amount);
}

function createStopPopup(stop) {
    let content = `<div class="stop-popup">
        <h6>${stop.name || 'Stop'}</h6>
        <p class="mb-1">Distance: ${formatDistance(stop.distance_from_start)}</p>`;

    if (stop.fuel_needed > 0) {
        content += `
            <p class="mb-1">Fuel level on arrival: ${stop.fuel_level_before.toFixed(1)}L</p>
            <p class="mb-1">Refuel amount: ${stop.fuel_needed.toFixed(1)}L</p>`;
    }

    if (stop.rest_time_needed) {
        content += `<p class="mb-1">Rest time: ${stop.rest_time_needed} minutes</p>`;
    }

    if (stop.facilities && stop.facilities.length > 0) {
        content += `<p class="mb-0"><small>Facilities: ${stop.facilities.join(', ')}</small></p>`;
    }

    content += '</div>';
    return content;
}

function createSegmentCard(segment) {
    return `
        <div class="result-card">
            <div class="d-flex justify-content-between align-items-center">
                <h6>${segment.start_location.address} → ${segment.end_location.address}</h6>
                <span class="badge bg-primary">${segment.transportation.type}</span>
            </div>
            <div class="result-detail">
                <p>Distance: ${formatDistance(segment.distance)}</p>
                <p>Duration: ${formatDuration(segment.duration)}</p>
                <p>Cost: ${formatCurrency(segment.total_segment_cost, 'USD')}</p>
            </div>
        </div>
    `;
}

function createStopCard(stop) {
    return `
        <div class="result-card">
            <div class="result-detail">
                <p><strong>Location:</strong> ${stop.location.address}</p>
                <p><strong>Duration:</strong> ${formatDuration(stop.duration)}</p>
                <p><strong>Available Facilities:</strong> ${stop.facilities.join(', ')}</p>
            </div>
        </div>
    `;
}

function createAccommodationCard(stay) {
    return `
        <div class="result-card">
            <h6>${stay.name}</h6>
            <div class="result-detail">
                <p><strong>Price:</strong> ${formatCurrency(stay.price_per_night, 'USD')} per night</p>
                <p><strong>Rating:</strong> ${stay.rating} ⭐ (${stay.reviews_count} reviews)</p>
                <p><strong>Distance to Center:</strong> ${formatDistance(stay.distance_to_center)}</p>
            </div>
        </div>
    `;
}

function showLoading() {
    // Implement loading state
}

function hideLoading() {
    // Hide loading state
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
