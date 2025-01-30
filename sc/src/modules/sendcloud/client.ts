import { MedusaError } from "@medusajs/framework/utils"
import { SendcloudOptions } from "./service"
import { SendcloudShippingMethodsResponse } from "./types"

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

    // Initialize auth token
    this.auth = Buffer.from(
      `${options.public_key}:${options.secret_key}`
    ).toString('base64')

    // Log initialization only in development
    if (process.env.NODE_ENV === 'development') {
      console.log("Sendcloud client initialized")
    }
  }

  private async sendRequest<T>(
    endpoint: string, 
    options?: RequestInit
  ): Promise<T> {
    try {
      const headers = {
        "Authorization": `Basic ${this.auth}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Requested-With": ""
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      })

      const responseText = await response.text()

      if (!response.ok) {
        let errorMessage: string
        try {
          const error = JSON.parse(responseText)
          errorMessage = `Sendcloud API error: ${JSON.stringify(error)}`
        } catch {
          errorMessage = `Sendcloud API error: ${responseText}`
        }

        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          errorMessage
        )
      }

      return JSON.parse(responseText)
    } catch (error) {
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
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Retrieves available shipping methods from Sendcloud.
   * @param params Optional parameters to filter shipping methods
   * @returns Promise<SendcloudShippingMethodsResponse>
   */
  async getShippingMethods(params?: { 
    to_country?: string, 
    from_country?: string 
  }): Promise<SendcloudShippingMethodsResponse> {
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
}