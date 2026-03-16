import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTripStore = defineStore('trip', () => {
  const origin = ref('')
  const destination = ref('')
  const transportationType = ref('')
  const passengers = ref(1)
  const minBudget = ref<number | null>(null)
  const maxBudget = ref<number | null>(null)
  const currency = ref('USD')
  const overnightStay = ref(false)
  const routeDetails = ref<any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function setTripData(data: any) {
    origin.value = data.origin
    destination.value = data.destination
    transportationType.value = data.transportationType
    passengers.value = data.passengers
    minBudget.value = data.minBudget
    maxBudget.value = data.maxBudget
    currency.value = data.currency
    overnightStay.value = data.overnightStay
  }

  function setRouteDetails(details: any) {
    routeDetails.value = details
  }

  function setLoading(value: boolean) {
    loading.value = value
  }

  function setError(value: string | null) {
    error.value = value
  }

  function clearError() {
    error.value = null
  }

  return {
    origin,
    destination,
    transportationType,
    passengers,
    minBudget,
    maxBudget,
    currency,
    overnightStay,
    routeDetails,
    loading,
    error,
    setTripData,
    setRouteDetails,
    setLoading,
    setError,
    clearError,
  }
})
