import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export const API = axios.create({
  baseURL: apiBaseUrl,
})

function cleanParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

export async function createMerchant(name) {
  const res = await API.post('/merchants', { name })
  return res.data
}

export async function getMerchants({ page = 0, size = 5, status, name } = {}) {
  const res = await API.get('/merchants', {
    params: cleanParams({ page, size, status, name }),
  })
  return res.data
}

export async function getMerchantSteps(id) {
  const res = await API.get(`/merchants/${id}/steps`)
  return res.data
}

export async function completeMerchantStep(merchantId, stepId) {
  const res = await API.post(`/merchants/${merchantId}/steps/${stepId}/complete`)
  return res.data
}

export async function getNextStep(id) {
  const res = await API.get(`/merchants/${id}/next-step`)
  return res.data
}

export async function addMerchantNote(id, payload) {
  const res = await API.post(`/merchants/${id}/notes`, payload)
  return res.data
}

export async function getMerchantNotes(id) {
  const res = await API.get(`/merchants/${id}/notes`)
  return res.data
}
