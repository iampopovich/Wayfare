import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface TripRequest {
  origin: string
  destination: string
  transportationType: string
  passengers?: number
  minBudget?: number
  maxBudget?: number
  currency?: string
  overnightStay?: boolean
  vehicleDetails?: any
}

export const tripService = {
  async calculateRoute(request: TripRequest) {
    const response = await apiClient.post('/travel/route', request)
    return response.data
  },

  async getRouteById(id: string) {
    const response = await apiClient.get(`/trip/${id}`)
    return response.data
  },

  async shareRoute(id: string) {
    const response = await apiClient.post(`/trip/${id}/share`)
    return response.data
  },
}
