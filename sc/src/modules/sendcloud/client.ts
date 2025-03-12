// src/modules/sendcloud/client.ts

import { MedusaError } from "@medusajs/framework/utils"
import { SendcloudOptions } from "./service"
import { 
  SendcloudShippingMethodsResponse, 
  SendcloudCreateParcelRequest,
  SendcloudCreateParcelResponse,
  SendcloudCancelResponse,
  SendcloudParcelResponse,
  SendcloudErrorResponse
} from "./types"

export class SendcloudClient {
  private baseUrl = "https://panel.sendcloud.sc/api/v2"
  private auth: string

  constructor(options: SendcloudOptions) {
    if (!options.public_key || !options.secret_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Sendcloud public_key and secret_key are required"
      )
    }

    this.auth = Buffer.from(
      `${options.public_key}:${options.secret_key}`
    ).toString('base64')

    if (process.env.NODE_ENV === 'development') {
      console.log("[SendcloudClient] Initialized")
    }
  }

  private async sendRequest<T>(
    endpoint: string, 
    options?: RequestInit
  ): Promise<T> {
    try {
      console.log(`[SendcloudClient] Sending ${options?.method || 'GET'} request to ${endpoint}`)
  
      const headers = {
        "Authorization": `Basic ${this.auth}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      }
  
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options?.headers,
        }
      })
  
      const contentType = response.headers.get("content-type")
      let data: any
  
      if (contentType?.includes("application/json")) {
        data = await response.json()
      } else {
        data = await response.text()
      }
  
      // For certain endpoints like cancel, a successful deletion might return specific messages
      if (endpoint.includes('/cancel') && !response.ok && response.status === 404) {
        console.log("[SendcloudClient] Parcel not found during cancel operation:", data)
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Parcel matches the given query."
        )
      }
  
      if (!response.ok) {
        const errorResponse = data as SendcloudErrorResponse
        console.error("[SendcloudClient] API Error:", errorResponse)
        
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          errorResponse.error?.message || 
          errorResponse.errors?.[0]?.message ||
          `Sendcloud API error: ${response.statusText}`
        )
      }
  
      console.log(`[SendcloudClient] Successfully received response from ${endpoint}`)
      return data as T
    } catch (error) {
      console.error("[SendcloudClient] Request Error:", error)
      
      if (error instanceof MedusaError) {
        throw error
      }
      
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Error contacting Sendcloud API: ${error.message}`
      )
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getShippingMethods()
      console.log("[SendcloudClient] Connection test successful")
      return true
    } catch (error) {
      console.error("[SendcloudClient] Connection test failed:", error)
      return false
    }
  }

  async getShippingMethods(params?: { 
    to_country?: string, 
    from_country?: string 
  }): Promise<SendcloudShippingMethodsResponse> {
    console.log("[SendcloudClient] Fetching shipping methods with params:", params)
    
    const queryParams = new URLSearchParams()
    
    if (params?.to_country) {
      queryParams.append('to_country', params.to_country)
    }
    if (params?.from_country) {
      queryParams.append('from_country', params.from_country)
    }

    const endpoint = `/shipping_methods${
      queryParams.toString() ? '?' + queryParams.toString() : ''
    }`
    
    return await this.sendRequest<SendcloudShippingMethodsResponse>(endpoint)
  }

  async createParcel(data: SendcloudCreateParcelRequest): Promise<SendcloudCreateParcelResponse> {
    console.log("[SendcloudClient] Creating parcel with data:", JSON.stringify(data, null, 2))
    
    return await this.sendRequest<SendcloudCreateParcelResponse>('/parcels', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getParcel(id: number): Promise<SendcloudParcelResponse> {
    console.log(`[SendcloudClient] Fetching parcel with ID: ${id}`)
    
    return await this.sendRequest<{ parcel: SendcloudParcelResponse }>(`/parcels/${id}`)
      .then(response => response.parcel)
  }

  async cancelParcel(id: number): Promise<SendcloudCancelResponse> {
    console.log(`[SendcloudClient] Cancelling parcel with ID: ${id}`)
    
    return await this.sendRequest<SendcloudCancelResponse>(`/parcels/${id}/cancel`, {
      method: 'POST'
    })
  }

  async getLabel(parcelId: number): Promise<{ label: { normal_printer: string[] } }> {
    console.log(`[SendcloudClient] Fetching label for parcel ID: ${parcelId}`)
    
    return await this.sendRequest<{ label: { normal_printer: string[] } }>(`/labels/${parcelId}`)
  }
}