<template>
  <AppLayout>
    <div class="row" v-if="error">
      <div class="col-12">
        <div class="alert alert-danger">{{ error }}</div>
      </div>
    </div>

    <div class="row">
      <!-- Left Column - Input Form -->
      <div class="col-md-4">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Trip Planning</h5>
            <form @submit.prevent="handleSubmit">
              <!-- Route Details -->
              <div class="mb-3">
                <label class="form-label">Origin</label>
                <InputText
                  v-model="form.origin"
                  class="w-100"
                  required
                  placeholder="Enter origin"
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Destination</label>
                <InputText
                  v-model="form.destination"
                  class="w-100"
                  required
                  placeholder="Enter destination"
                />
              </div>

              <!-- Transportation -->
              <div class="mb-3">
                <label class="form-label">Transportation Type</label>
                <Dropdown
                  v-model="form.transportationType"
                  :options="transportationOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Select Type"
                  class="w-100"
                  required
                />
              </div>

              <!-- Car Details -->
              <div v-if="form.transportationType === 'car'" class="mb-3">
                <h6>Car Details</h6>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label for="carModel" class="form-label">Car Model</label>
                    <InputText id="carModel" v-model="vehicleDetails.carModel" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="engineVolume" class="form-label">Engine Volume (L)</label>
                    <InputNumber id="engineVolume" v-model="vehicleDetails.engineVolume" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="fuelConsumption" class="form-label">Fuel Consumption (L/100km)</label>
                    <InputNumber id="fuelConsumption" v-model="vehicleDetails.fuelConsumption" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="tankCapacity" class="form-label">Tank Capacity (L)</label>
                    <InputNumber id="tankCapacity" v-model="vehicleDetails.tankCapacity" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="initialFuel" class="form-label">Current Fuel Level (L)</label>
                    <InputNumber id="initialFuel" v-model="vehicleDetails.initialFuel" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="fuelType" class="form-label">Fuel Type</label>
                    <Dropdown
                      id="fuelType"
                      v-model="vehicleDetails.fuelType"
                      :options="fuelTypeOptions"
                      option-label="label"
                      option-value="value"
                      class="w-100"
                    />
                  </div>
                </div>
              </div>

              <!-- Motorcycle Details -->
              <div v-if="form.transportationType === 'motorcycle'" class="mb-3">
                <h6>Motorcycle Details</h6>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label for="engineCC" class="form-label">Engine Size (CC)</label>
                    <InputNumber id="engineCC" v-model="vehicleDetails.engineCC" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="motorcycleFuelConsumption" class="form-label">Fuel Economy (km/L)</label>
                    <InputNumber id="motorcycleFuelConsumption" v-model="vehicleDetails.fuelConsumption" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="motorcycleTankCapacity" class="form-label">Tank Capacity (L)</label>
                    <InputNumber id="motorcycleTankCapacity" v-model="vehicleDetails.tankCapacity" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="motorcycleInitialFuel" class="form-label">Current Fuel Level (L)</label>
                    <InputNumber id="motorcycleInitialFuel" v-model="vehicleDetails.initialFuel" class="w-100" />
                  </div>
                  <div class="col-md-6">
                    <label for="motorcycleFuelType" class="form-label">Fuel Type</label>
                    <Dropdown
                      id="motorcycleFuelType"
                      v-model="vehicleDetails.fuelType"
                      :options="motorcycleFuelTypeOptions"
                      option-label="label"
                      option-value="value"
                      class="w-100"
                    />
                  </div>
                </div>
              </div>

              <!-- Passengers -->
              <div class="mb-3">
                <label class="form-label">Number of Passengers</label>
                <InputNumber v-model="form.passengers" :min="1" class="w-100" />
              </div>

              <!-- Budget -->
              <div class="mb-3">
                <label class="form-label">Budget Range</label>
                <div class="input-group">
                  <InputNumber v-model="form.minBudget" placeholder="Min" class="flex-grow-1" />
                  <InputNumber v-model="form.maxBudget" placeholder="Max" class="flex-grow-1" />
                  <Dropdown v-model="form.currency" :options="currencyOptions" class="flex-grow-1" />
                </div>
              </div>

              <!-- Overnight Stay -->
              <div class="mb-3">
                <div class="form-check">
                  <Checkbox
                    id="overnightStay"
                    v-model="form.overnightStay"
                    :binary="true"
                    class="form-check-input"
                  />
                  <label for="overnightStay" class="form-check-label">Include Overnight Stays</label>
                </div>
              </div>

              <!-- Submit Button -->
              <Button
                type="submit"
                label="Calculate Route"
                icon="pi pi-calculator"
                :loading="loading"
                class="mt-3"
              />
            </form>
          </div>
        </div>
      </div>

      <!-- Right Column - Results -->
      <div class="col-md-8">
        <!-- Map -->
        <div class="card mb-3">
          <div class="card-body">
            <div id="map" style="height: 400px;"></div>
          </div>
        </div>

        <!-- Results -->
        <div class="card" v-if="routeDetails">
          <div class="card-body">
            <TabView>
              <TabPanel header="Route">
                <div v-html="routeDetails.description"></div>
              </TabPanel>
              <TabPanel header="Stops">
                <p>Stops information coming soon...</p>
              </TabPanel>
              <TabPanel header="Weather">
                <p>Weather information coming soon...</p>
              </TabPanel>
              <TabPanel header="Costs">
                <p>Cost breakdown coming soon...</p>
              </TabPanel>
              <TabPanel header="Health">
                <p>Health recommendations coming soon...</p>
              </TabPanel>
            </TabView>
          </div>
        </div>

        <!-- Share Button -->
        <Button
          v-if="routeDetails"
          label="Share Route"
          icon="pi pi-share-alt"
          severity="success"
          class="mt-3"
          @click="handleShare"
        />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { useTripStore } from '@/stores/tripStore'
import { tripService, type TripRequest } from '@/services/tripService'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default marker icon path issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const store = useTripStore()
const loading = ref(false)

let mapInstance: L.Map | null = null
let routeLayer: L.LayerGroup | null = null

onMounted(() => {
  mapInstance = L.map('map').setView([55.75, 37.62], 5)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(mapInstance)
  routeLayer = L.layerGroup().addTo(mapInstance)
})

watch(
  () => store.routeDetails,
  (details) => {
    if (!mapInstance || !routeLayer || !details) return
    routeLayer.clearLayers()

    const pathPoints: [number, number][] = details.route?.pathPoints ?? []
    if (pathPoints.length >= 2) {
      const polyline = L.polyline(pathPoints, { color: '#3b82f6', weight: 4 })
      polyline.addTo(routeLayer)
      mapInstance.fitBounds(polyline.getBounds(), { padding: [40, 40] })
    }

    // Start marker
    const firstSeg = details.route?.segments?.[0]
    if (firstSeg?.startLocation) {
      const { latitude: lat, longitude: lng, address } = firstSeg.startLocation
      L.marker([lat, lng]).addTo(routeLayer).bindPopup(`<b>Start</b><br>${address ?? ''}`)
    }

    // End marker
    const lastSeg = details.route?.segments?.[details.route.segments.length - 1]
    if (lastSeg?.endLocation) {
      const { latitude: lat, longitude: lng, address } = lastSeg.endLocation
      L.marker([lat, lng]).addTo(routeLayer).bindPopup(`<b>End</b><br>${address ?? ''}`)
    }

    // Stop markers
    for (const stop of details.stops ?? []) {
      if (stop.location?.latitude && stop.location?.longitude) {
        L.circleMarker([stop.location.latitude, stop.location.longitude], {
          radius: 6, color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.9,
        })
          .addTo(routeLayer)
          .bindPopup(`<b>${stop.name ?? stop.type}</b><br>${stop.estimatedTime ?? ''}`)
      }
    }
  },
)

const form = reactive({
  origin: '',
  destination: '',
  transportationType: '',
  passengers: 1,
  minBudget: null as number | null,
  maxBudget: null as number | null,
  currency: 'USD',
  overnightStay: false,
})

const vehicleDetails = reactive({
  carModel: 'Standard 1.6L',
  engineVolume: 1.6,
  fuelConsumption: 11.0,
  tankCapacity: 50.0,
  initialFuel: 25.0,
  fuelType: 'gasoline',
  engineCC: 125,
})

const transportationOptions = [
  { label: 'Select Type', value: '' },
  { label: 'Car', value: 'car' },
  { label: 'Motorcycle', value: 'motorcycle' },
  { label: 'Bicycle', value: 'bicycle' },
  { label: 'Walking', value: 'walking' },
  { label: 'Bus', value: 'bus' },
  { label: 'Train', value: 'train' },
  { label: 'Plane', value: 'plane' },
  { label: 'Sea Transport', value: 'sea' },
]

const fuelTypeOptions = [
  { label: 'Gasoline', value: 'gasoline' },
  { label: 'Diesel', value: 'diesel' },
  { label: 'Electric', value: 'electric' },
]

const motorcycleFuelTypeOptions = [
  { label: '92 Octane', value: '92' },
  { label: '95 Octane', value: '95' },
  { label: '98 Octane', value: '98' },
]

const currencyOptions = ['USD', 'EUR', 'RUB']

const error = computed(() => store.error)
const routeDetails = computed(() => store.routeDetails)

async function handleSubmit() {
  loading.value = true
  store.clearError()

  try {
    const request: TripRequest = {
      origin: form.origin,
      destination: form.destination,
      transportationType: form.transportationType,
      passengers: form.passengers,
      minBudget: form.minBudget ?? undefined,
      maxBudget: form.maxBudget ?? undefined,
      currency: form.currency,
      overnightStay: form.overnightStay,
      vehicleDetails: form.transportationType === 'car' || form.transportationType === 'motorcycle' 
        ? vehicleDetails 
        : undefined,
    }

    const result = await tripService.calculateRoute(request)
    store.setRouteDetails(result)
  } catch (err: any) {
    store.setError(err.message || 'Failed to calculate route')
  } finally {
    loading.value = false
  }
}

async function handleShare() {
  // Share functionality to be implemented
  alert('Share functionality coming soon...')
}
</script>

<style scoped>
h6 {
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
